import re
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Optional
from app.api.deps import get_current_user
from app.models.database import User
from app.services.claude_service import complete

router = APIRouter(prefix="/api/profile-chat", tags=["profile-chat"])

# ── System prompts per section ─────────────────────────────────────────────────

_FIELD_INSTRUCTIONS = """
When the user provides information that maps to one or more form fields, include
a <field_updates> block at the very end of your reply (never mid-sentence):

<field_updates>
{"field_name": value, ...}
</field_updates>

If nothing needs to be updated, omit the block entirely.
Boolean fields must be JSON true/false (not strings).
Date fields use YYYY-MM format.
"""

SECTION_PROMPTS: dict[str, str] = {
    "contact": f"""You are a knowledgeable, friendly VA claims assistant helping a veteran
fill out the Contact Information section of VA Form 21-526EZ.

Available fields:
- va_file_number (string) — VA file number from prior claims
- service_number_dod_id (string) — military service number or DoD ID on their ID card
- prior_va_claim (boolean) — have they previously filed a VA claim
- phone_number (string) — daytime phone with area code
- address_street, address_apt, address_city, address_state (2-letter), address_zip, address_country
- consent_electronic_correspondence (boolean) — ok to receive VA emails
- is_va_employee (boolean)

Be warm and conversational. Answer any questions about why the VA needs a field.
{_FIELD_INSTRUCTIONS}""",

    "homeless": f"""You are a compassionate VA claims assistant helping a veteran fill out
the Homeless Information section of VA Form 21-526EZ.

Homeless/at-risk veterans receive expedited claim processing — this section can meaningfully
speed up a claim. Be non-judgmental and reassuring.

Available fields:
- currently_homeless (boolean)
- homeless_situation (string): one of shelter | not_shelter | fleeing_domestic_violence |
  transitional_housing | temporarily_with_others
- at_risk_of_homeless (boolean)
- at_risk_situation (string): one of losing_housing | leaving_institution | other
- homeless_poc_name (string) — social worker or contact name (optional)
- homeless_poc_phone (string) — contact phone (optional)
{_FIELD_INSTRUCTIONS}""",

    "service": f"""You are an experienced VA claims assistant helping a veteran document
their military service history for VA Form 21-526EZ.

Service records is an array. Each period of service has:
- branch: Army | Navy | Marine Corps | Air Force | Space Force | Coast Guard
- component: Active Duty | Reserve | National Guard
- entry_date, exit_date (YYYY-MM)
- place_of_separation (string, e.g. "Fort Campbell, KY")
- served_under_other_name (boolean), other_name (string)
- combat_zone_post_911 (boolean)
- pow_status (boolean), pow_confinement_from, pow_confinement_to (YYYY-MM)
- reserve_ng (boolean), reserve_component, reserve_from, reserve_to (YYYY-MM)
- reserve_unit_name, reserve_unit_address, reserve_unit_phone
- currently_activated (boolean), activation_date, anticipated_separation_date (YYYY-MM)
- inactive_duty_training_pay (boolean)

When updating, return the full updated service_records array.
{_FIELD_INSTRUCTIONS}""",

    "exposure": f"""You are a knowledgeable VA claims assistant helping a veteran document
toxic and environmental exposures for VA Form 21-526EZ.

You know the major presumptive exposure programs: PACT Act, Agent Orange, Gulf War illness,
Camp Lejeune. Proactively mention relevant presumptive conditions when an exposure is confirmed.

Available fields (all boolean unless noted):
- toxic_exposure_claimed
- gulf_war_service, gulf_war_locations (string), gulf_war_from, gulf_war_to (YYYY-MM)
- herbicide_exposure, herbicide_locations, herbicide_other_locations, herbicide_from, herbicide_to
- asbestos, mustard_gas, radiation, shad, mos_toxin, camp_lejeune_water, other_exposure
- exposure_from, exposure_to (YYYY-MM)
- additional_exposure_notes (string)
{_FIELD_INSTRUCTIONS}""",

    "service-pay": f"""You are a knowledgeable VA claims assistant helping a veteran fill out
the Service Pay section of VA Form 21-526EZ.

Key knowledge: Under CRDP, veterans rated 50%+ can receive FULL military retired pay AND VA
compensation simultaneously — no waiver needed. Only veterans below 50% combined rating need
to waive dollar-for-dollar. Explain this proactively if relevant.

Available fields:
- receiving_retired_pay (boolean)
- future_retired_pay (boolean)
- retired_pay_branch (string)
- retired_pay_monthly_amount (string, e.g. "$2,400")
- retired_status: retired_list | permanent_disability | temp_disability
- waive_va_for_retired_pay (boolean)
- separation_pay_received (boolean)
- separation_pay_date (YYYY-MM), separation_pay_branch, separation_pay_amount (string)
- waive_va_for_training_pay (boolean)
{_FIELD_INSTRUCTIONS}""",
}

SECTION_GREETINGS: dict[str, str] = {
    "contact": "Hi! I'll help you fill out your contact information. You can type your details conversationally — like \"my phone is 555-1234\" or \"I live in Austin, TX\" — and I'll fill them in. Or just use the form directly. What questions do you have?",
    "homeless": "This section asks about your current housing situation. If you're experiencing homelessness or housing instability, the VA flags your claim for faster processing. Everything is confidential. Feel free to tell me about your situation, or skip this section if it doesn't apply to you.",
    "service": "Let's capture your military service history. You can describe your service naturally — \"I served in the Army on active duty from January 2001 to March 2008\" — and I'll fill in the details. Do you have your DD-214 nearby? It makes this easier.",
    "exposure": "This section covers hazardous exposures during your service. These matter a lot — many exposures qualify for presumptive service connection, which can significantly strengthen your claim. Tell me where you served and I can help identify relevant exposures.",
    "service-pay": "This section covers military retired pay and separation pay. The rules around concurrent receipt can be confusing — I'm happy to explain them. What questions do you have, or go ahead and tell me about your pay situation.",
}


# ── Schema ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ProfileChatRequest(BaseModel):
    section: str
    messages: list[ChatMessage]
    current_data: Optional[dict[str, Any]] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

_UPDATES_RE = re.compile(r"<field_updates>\s*(.*?)\s*</field_updates>", re.DOTALL)


def _parse_response(text: str) -> tuple[str, dict | None]:
    """Strip <field_updates> block from text and parse it."""
    m = _UPDATES_RE.search(text)
    if not m:
        return text.strip(), None
    display = _UPDATES_RE.sub("", text).strip()
    try:
        updates = json.loads(m.group(1))
    except json.JSONDecodeError:
        updates = None
    return display, updates


# ── Route ──────────────────────────────────────────────────────────────────────

@router.get("/greeting/{section}")
async def section_greeting(section: str, _: User = Depends(get_current_user)):
    return {"greeting": SECTION_GREETINGS.get(section, "How can I help you with this section?")}


@router.post("/send")
async def profile_chat_send(
    body: ProfileChatRequest,
    current_user: User = Depends(get_current_user),
):
    system = SECTION_PROMPTS.get(body.section)
    if not system:
        return {"reply": "I'm not sure how to help with that section.", "field_updates": None}

    if body.current_data:
        system += f"\n\nCurrent form data (already filled):\n{json.dumps(body.current_data, indent=2)}"

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    raw = await complete(system, messages, max_tokens=1024)
    reply, field_updates = _parse_response(raw)

    return {"reply": reply, "field_updates": field_updates}
