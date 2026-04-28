"""Assembles VA Form 21-526EZ data from User / VeteranProfile / ServicePay /
Case (assessment) records, merged with per-case `form_overrides`.

The form is structured into sections matching the official PDF. Each section
is a dict of field-name → value. Array sections (claims, service_records,
exposures) hold lists of dicts.

Override semantics:
- Atomic fields: leaf-level shadow. If `overrides.section_X.foo` is set, it
  replaces the auto-populated value.
- Array fields: full replacement. If `overrides.section_X.items` is a list,
  it fully replaces the auto-populated array. To re-pull from auto, the
  user clears the override.

The frontend distinguishes "auto" / "manually edited" / "empty" by inspecting
the `overrides` map separately from `data`.
"""

import json
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import Case, User, VeteranProfile, ServicePay
from app.core.encryption import decrypt


def _dec(val: Optional[str]) -> Optional[str]:
    return decrypt(val) if val else None


def _deep_merge(auto: dict, overrides: dict) -> dict:
    """Merge overrides into auto.

    Rules:
    - Dict values: recurse.
    - Non-empty list overrides: full replacement (override wins).
    - Empty list/None overrides: auto wins (treat as "no override set").
    - Scalar overrides: override wins if not None.
    """
    out = dict(auto)
    for k, ov in overrides.items():
        if ov is None:
            continue
        if isinstance(ov, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], ov)
        elif isinstance(ov, list):
            if len(ov) > 0:
                out[k] = ov
        else:
            out[k] = ov
    return out


async def _load_sources(case_id: str, user: User, db: AsyncSession) -> dict:
    """Load Case + VeteranProfile + ServicePay for the case owner."""
    case_result = await db.execute(
        select(Case).where(Case.id == case_id, Case.user_id == user.id)
    )
    case = case_result.scalar_one_or_none()
    if not case:
        return {"case": None, "profile": None, "service_pay": None}

    vp_result = await db.execute(
        select(VeteranProfile).where(VeteranProfile.user_id == user.id)
    )
    sp_result = await db.execute(
        select(ServicePay).where(ServicePay.user_id == user.id)
    )

    return {
        "case": case,
        "profile": vp_result.scalar_one_or_none(),
        "service_pay": sp_result.scalar_one_or_none(),
    }


def _build_section_1(user: User, vp: Optional[VeteranProfile]) -> dict:
    """Section I — Claim program type + Veteran identification + contact info."""
    return {
        "claim_program_type": vp.claim_program_type if vp else None,  # FDC|Standard|IDES|BDD
        "veteran_name_first": _dec(user.first_name_encrypted),
        "veteran_name_middle": _dec(user.middle_name_encrypted),
        "veteran_name_last": _dec(user.last_name_encrypted),
        # SSN and DOB are intentionally not collected by this app — the
        # veteran writes them on the form by hand at submission time.
        "ssn": None,
        "filed_claim_before": vp.prior_va_claim if vp else None,
        "va_file_number": vp.va_file_number if vp else None,
        "date_of_birth": None,
        "service_number_dod_id": vp.service_number_dod_id if vp else None,
        "bdd_release_date": vp.bdd_anticipated_release_date if vp else None,
        "phone": _dec(vp.phone_number_encrypted) if vp else None,
        "phone_international": None,
        "email": user.email,
        "email_consent_correspondence": vp.consent_electronic_correspondence if vp else None,
        "address_street": _dec(vp.address_street_encrypted) if vp else None,
        "address_apt": vp.address_apt if vp else None,
        "address_city": vp.address_city if vp else None,
        "address_state": vp.address_state if vp else None,
        "address_country": vp.address_country if vp else None,
        "address_zip": vp.address_zip if vp else None,
        "is_va_employee": vp.is_va_employee if vp else None,
    }


def _build_section_2() -> dict:
    """Section II — Change of Address. Optional, user-input only."""
    return {
        "address_change_type": None,  # TEMPORARY | PERMANENT
        "new_address_street": None,
        "new_address_apt": None,
        "new_address_city": None,
        "new_address_state": None,
        "new_address_country": None,
        "new_address_zip": None,
        "effective_beginning_date": None,
        "effective_ending_date": None,
    }


def _build_section_3(vp: Optional[VeteranProfile]) -> dict:
    """Section III — Homeless Information."""
    return {
        "currently_homeless": vp.currently_homeless if vp else None,
        "homeless_situation": vp.homeless_situation if vp else None,
        "at_risk_of_homeless": vp.at_risk_of_homeless if vp else None,
        "at_risk_situation": vp.at_risk_situation if vp else None,
        "poc_name": _dec(vp.homeless_poc_name_encrypted) if vp else None,
        "poc_phone": _dec(vp.homeless_poc_phone_encrypted) if vp else None,
    }


def _build_section_4(vp: Optional[VeteranProfile]) -> dict:
    """Section IV — Exposure Information."""
    exp = (vp.exposure_data if vp else {}) or {}
    return {
        "claiming_toxic_exposure": exp.get("toxic_exposure_claimed"),
        "gulf_war_service": exp.get("gulf_war_service"),
        "gulf_war_locations": exp.get("gulf_war_locations"),
        "gulf_war_from": exp.get("gulf_war_from"),
        "gulf_war_to": exp.get("gulf_war_to"),
        "herbicide_exposure": exp.get("herbicide_exposure"),
        "herbicide_locations": exp.get("herbicide_locations"),
        "herbicide_other_locations": exp.get("herbicide_other_locations"),
        "herbicide_from": exp.get("herbicide_from"),
        "herbicide_to": exp.get("herbicide_to"),
        "exposure_types": {
            "asbestos": bool(exp.get("asbestos")),
            "mustard_gas": bool(exp.get("mustard_gas")),
            "radiation": bool(exp.get("radiation")),
            "shad": bool(exp.get("shad")),
            "mos_toxin": bool(exp.get("mos_toxin")),
            "camp_lejeune_water": bool(exp.get("camp_lejeune_water")),
            "other": bool(exp.get("other_exposure")),
        },
        "other_exposure_specify": exp.get("other_exposure"),
        "exposure_from": exp.get("exposure_from"),
        "exposure_to": exp.get("exposure_to"),
        "additional_exposure_notes": exp.get("additional_exposure_notes"),
    }


def _condition_to_claim_row(cond: dict, vp: Optional[VeteranProfile]) -> dict:
    """Convert one assessment condition into a Section V claim row.

    The form columns are:
    - CURRENT DISABILITY(IES)
    - IF DUE TO EXPOSURE, EVENT, OR INJURY, PLEASE SPECIFY
    - EXPLAIN HOW THE DISABILITY(IES) RELATES TO THE IN-SERVICE EVENT/EXPOSURE/INJURY
    - APPROXIMATE DATE DISABILITY(IES) BEGAN OR WORSENED
    """
    name = cond.get("name") or ""
    cond_type = (cond.get("type") or "").lower()
    evidence = cond.get("evidence") or ""

    # Derive "exposure/event/injury" hint from condition type + exposure profile
    exposure_hint = None
    if cond_type == "presumptive":
        exp = (vp.exposure_data if vp else {}) or {}
        if exp.get("herbicide_exposure"):
            exposure_hint = "Agent Orange / herbicide exposure"
        elif exp.get("camp_lejeune_water"):
            exposure_hint = "Camp Lejeune contaminated water"
        elif exp.get("gulf_war_service"):
            exposure_hint = "Gulf War service"
        elif exp.get("radiation"):
            exposure_hint = "Ionizing radiation exposure"
    elif cond_type == "secondary":
        exposure_hint = "Secondary to service-connected condition"

    return {
        "disability": name,
        "exposure_event_injury": exposure_hint,
        "explanation": evidence,
        "approximate_date": None,  # not captured in assessment; user fills in
        # Carried through for the frontend / PDF fill but not on the form's row:
        "_dc_code": cond.get("dc_code"),
        "_icd10": cond.get("icd10"),
        "_type": cond.get("type"),
        "_nexus_needed": cond.get("nexus_needed"),
    }


def _build_section_5_and_13(case: Case, vp: Optional[VeteranProfile]) -> tuple[dict, dict]:
    """Section V (Claim Information) — first 15 conditions go on page 11.
    Section XIII (Addendum) — overflow conditions 16-35 go on page 15.

    Source: case.assessment_result_encrypted produced by the Condition Assessor.
    """
    assessment: dict = {}
    if case.assessment_result_encrypted:
        try:
            assessment = json.loads(decrypt(case.assessment_result_encrypted))
        except (ValueError, TypeError):
            assessment = {}

    conditions: list[dict] = assessment.get("conditions", []) or []
    rows = [_condition_to_claim_row(c, vp) for c in conditions]

    section_5 = {
        # Up to 15 rows fit in Section V on the official form
        "claims": rows[:15],
        "treatment_facilities": [],  # user-input list of {disability, facility, date}
    }
    section_13 = {
        # Overflow goes here; the form addendum has 20 more rows
        "claims": rows[15:35],
    }
    return section_5, section_13


def _build_section_6(vp: Optional[VeteranProfile]) -> dict:
    """Section VI — Service Information.

    The veteran_profile.service_records JSON array holds one entry per period
    of service. The form's primary block is for the most recent active period;
    earlier periods feed into "Additional periods of service".
    """
    records = (vp.service_records if vp else []) or []
    most_recent = records[0] if records else {}
    additional = records[1:] if len(records) > 1 else []

    return {
        "served_under_other_name": most_recent.get("served_under_other_name"),
        "other_names": most_recent.get("other_name"),
        "branch": most_recent.get("branch"),
        "component": most_recent.get("component"),  # active | reserves | national_guard
        "entry_date": most_recent.get("entry_date"),
        "exit_date": most_recent.get("exit_date"),
        "place_of_separation": most_recent.get("place_of_separation"),
        "combat_zone_post_911": most_recent.get("combat_zone_post_911"),
        "additional_periods": additional,
        "reserve_ng": most_recent.get("reserve_ng"),
        "reserve_component": most_recent.get("reserve_component"),
        "reserve_from": most_recent.get("reserve_from"),
        "reserve_to": most_recent.get("reserve_to"),
        "reserve_unit_name": most_recent.get("reserve_unit_name"),
        "reserve_unit_address": most_recent.get("reserve_unit_address"),
        "reserve_unit_phone": most_recent.get("reserve_unit_phone"),
        "inactive_duty_training_pay": most_recent.get("inactive_duty_training_pay"),
        "currently_activated": most_recent.get("currently_activated"),
        "activation_date": most_recent.get("activation_date"),
        "anticipated_separation_date": most_recent.get("anticipated_separation_date"),
        "pow_status": most_recent.get("pow_status"),
        "pow_confinement_from": most_recent.get("pow_confinement_from"),
        "pow_confinement_to": most_recent.get("pow_confinement_to"),
    }


def _build_section_7(sp: Optional[ServicePay]) -> dict:
    """Section VII — Service Pay (retired pay, separation pay)."""
    return {
        "receiving_retired_pay": sp.receiving_retired_pay if sp else None,
        "future_retired_pay": sp.future_retired_pay if sp else None,
        "retired_pay_branch": sp.retired_pay_branch if sp else None,
        "retired_pay_monthly_amount": _dec(sp.retired_pay_monthly_amount_encrypted) if sp else None,
        "retired_status": sp.retired_status if sp else None,
        "waive_va_for_retired_pay": sp.waive_va_for_retired_pay if sp else None,
        "separation_pay_received": sp.separation_pay_received if sp else None,
        "separation_pay_date": sp.separation_pay_date if sp else None,
        "separation_pay_branch": sp.separation_pay_branch if sp else None,
        "separation_pay_amount": _dec(sp.separation_pay_amount_encrypted) if sp else None,
        "waive_va_for_training_pay": sp.waive_va_for_training_pay if sp else None,
    }


def _build_section_8() -> dict:
    """Section VIII — Direct Deposit. Not stored by this app (PCI/PII).
    The veteran fills this in by hand after downloading the PDF.
    """
    return {
        "no_account": None,
        "account_type": None,  # checking | savings
        "account_number": None,
        "financial_institution": None,
        "routing_number": None,
    }


def _calculate_completion(data: dict) -> dict:
    """Lightweight completion summary — counts populated fields per section.
    Helps the UI surface which sections still need attention.
    """
    def count(d: Any) -> tuple[int, int]:
        # (filled, total) — recursive
        if isinstance(d, dict):
            f, t = 0, 0
            for k, v in d.items():
                if k.startswith("_"):
                    continue
                fi, ti = count(v)
                f += fi
                t += ti
            return f, t
        if isinstance(d, list):
            f, t = 0, 0
            for item in d:
                fi, ti = count(item)
                f += fi
                t += ti
            return f, t
        return (1, 1) if d not in (None, "", []) else (0, 1)

    summary = {}
    for section_key, section_data in data.items():
        filled, total = count(section_data)
        summary[section_key] = {"filled": filled, "total": total}

    total_filled = sum(s["filled"] for s in summary.values())
    total_fields = sum(s["total"] for s in summary.values())
    return {
        "by_section": summary,
        "filled": total_filled,
        "total": total_fields,
        "percent": round(100 * total_filled / total_fields) if total_fields else 0,
    }


async def assemble_form_data(case_id: str, user: User, db: AsyncSession) -> Optional[dict]:
    """Assemble the full 21-526EZ form data for a case.

    Returns None if the case doesn't exist or isn't owned by the user.
    """
    sources = await _load_sources(case_id, user, db)
    case: Optional[Case] = sources["case"]
    if not case:
        return None

    vp = sources["profile"]
    sp = sources["service_pay"]

    section_5, section_13 = _build_section_5_and_13(case, vp)

    auto = {
        "section_1": _build_section_1(user, vp),
        "section_2": _build_section_2(),
        "section_3": _build_section_3(vp),
        "section_4": _build_section_4(vp),
        "section_5": section_5,
        "section_6": _build_section_6(vp),
        "section_7": _build_section_7(sp),
        "section_8": _build_section_8(),
        "section_13": section_13,
    }

    overrides: dict = case.form_overrides or {}
    merged = _deep_merge(auto, overrides)

    return {
        "data": merged,
        "auto": auto,
        "overrides": overrides,
        "completion": _calculate_completion(merged),
    }


async def save_form_overrides(
    case_id: str,
    user: User,
    db: AsyncSession,
    overrides: dict,
) -> bool:
    """Persist form overrides on the case. Returns True if saved, False if
    the case doesn't exist."""
    result = await db.execute(
        select(Case).where(Case.id == case_id, Case.user_id == user.id)
    )
    case = result.scalar_one_or_none()
    if not case:
        return False
    case.form_overrides = overrides
    await db.commit()
    return True
