import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.database import get_db, Case, Letter, Document, User
from app.api.deps import get_current_user
from app.core.encryption import encrypt, decrypt
from app.services.skills_loader import get_condition_assessor_prompt, get_nexus_letter_prompt
from app.services.claude_service import complete
from app.services.document_service import retrieve_extracted_text

router = APIRouter(prefix="/api/cases/{case_id}", tags=["assessment", "letters"])


async def _get_case(case_id: str, user: User, db: AsyncSession) -> Case:
    result = await db.execute(select(Case).where(Case.id == case_id, Case.user_id == user.id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


# ── Assessment ────────────────────────────────────────────────────────────────

@router.post("/assess")
async def run_assessment(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the va-condition-assessor skill against all uploaded documents + interview data."""
    case = await _get_case(case_id, user, db)

    # Gather extracted text from all processed documents
    doc_result = await db.execute(
        select(Document).where(Document.case_id == case_id, Document.processed == True)
    )
    docs = doc_result.scalars().all()
    doc_texts = []
    for doc in docs:
        if doc.extracted_text_path:
            text = retrieve_extracted_text(doc.extracted_text_path)
            doc_texts.append(f"### Document: {doc.original_filename}\n{text}")

    if not doc_texts:
        raise HTTPException(status_code=400, detail="No processed documents found. Upload medical records first.")

    combined_docs = "\n\n".join(doc_texts)

    messages = [
        {
            "role": "user",
            "content": (
                "Please perform a full condition assessment based on the following medical documents.\n\n"
                "Output your assessment as structured JSON with this schema:\n"
                "{\n"
                '  "conditions": [\n'
                '    {\n'
                '      "name": "condition name",\n'
                '      "dc_code": "XXXX",\n'
                '      "icd10": "X00.0",\n'
                '      "evidence": "what supports this",\n'
                '      "current_rating_pct": 0,\n'
                '      "rating_basis": "explanation",\n'
                '      "pathway_to_higher": "what evidence is missing",\n'
                '      "dbq_form": "form name",\n'
                '      "type": "primary|secondary|presumptive",\n'
                '      "nexus_needed": true\n'
                "    }\n"
                "  ],\n"
                '  "secondary_opportunities": [\n'
                '    {"condition": "", "caused_by": "", "evidence_status": "", "next_step": ""}\n'
                "  ],\n"
                '  "priority_actions": [\n'
                '    {"action": "", "expected_impact": ""}\n'
                "  ],\n"
                '  "combined_rating_current": 0,\n'
                '  "combined_rating_potential": 0\n'
                "}\n\n"
                "Medical Documents:\n\n"
                f"{combined_docs}"
            ),
        }
    ]

    result_text = await complete(get_condition_assessor_prompt(), messages, max_tokens=4096)

    # Extract JSON from response
    try:
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        assessment_json = json.loads(result_text[start:end])
    except (json.JSONDecodeError, ValueError):
        assessment_json = {"raw": result_text}

    case.assessment_result_encrypted = encrypt(json.dumps(assessment_json))
    case.status = "in_progress"
    await db.commit()

    return assessment_json


@router.get("/assessment")
async def get_assessment(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _get_case(case_id, user, db)
    if not case.assessment_result_encrypted:
        raise HTTPException(status_code=404, detail="No assessment yet. Upload documents and run assessment first.")
    return json.loads(decrypt(case.assessment_result_encrypted))


# ── Letters ───────────────────────────────────────────────────────────────────

class LetterRequest(BaseModel):
    condition_name: str
    letter_type: str  # provider | personal | buddy
    dc_code: Optional[str] = None
    service_event: Optional[str] = None
    author_info: Optional[str] = None
    additional_context: Optional[str] = None


class LetterResponse(BaseModel):
    id: str
    letter_type: str
    condition_name: str
    content: str
    advisory_notes: Optional[dict]
    created_at: str


@router.post("/letters", status_code=201, response_model=LetterResponse)
async def generate_letter(
    case_id: str,
    body: LetterRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _get_case(case_id, user, db)

    # Pull assessment for context
    assessment_context = ""
    if case.assessment_result_encrypted:
        assessment = json.loads(decrypt(case.assessment_result_encrypted))
        # Find this condition in the assessment
        for cond in assessment.get("conditions", []):
            if cond.get("name", "").lower() == body.condition_name.lower():
                assessment_context = f"Assessment data for this condition:\n{json.dumps(cond, indent=2)}"
                break

    messages = [
        {
            "role": "user",
            "content": (
                f"Generate a {body.letter_type} nexus letter for the following:\n\n"
                f"**Condition:** {body.condition_name}\n"
                f"**DC Code:** {body.dc_code or 'Unknown'}\n"
                f"**Letter Type:** {body.letter_type}\n"
                f"**In-Service Event:** {body.service_event or 'Not specified'}\n"
                f"**Author Info:** {body.author_info or 'Not specified'}\n"
                f"**Additional Context:** {body.additional_context or 'None'}\n\n"
                f"{assessment_context}\n\n"
                "Output as JSON:\n"
                "{\n"
                '  "letter_content": "full letter text",\n'
                '  "advisory_notes": {\n'
                '    "strengths": [],\n'
                '    "vulnerabilities": [],\n'
                '    "recommended_supporting_docs": [],\n'
                '    "strategic_notes": ""\n'
                "  }\n"
                "}"
            ),
        }
    ]

    result_text = await complete(get_nexus_letter_prompt(), messages, max_tokens=3000)

    try:
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        parsed = json.loads(result_text[start:end])
        letter_content = parsed.get("letter_content", result_text)
        advisory_notes = parsed.get("advisory_notes")
    except (json.JSONDecodeError, ValueError):
        letter_content = result_text
        advisory_notes = None

    letter = Letter(
        case_id=case_id,
        letter_type=body.letter_type,
        condition_name=body.condition_name,
        content_encrypted=encrypt(letter_content),
        advisory_notes=advisory_notes,
    )
    db.add(letter)
    await db.commit()
    await db.refresh(letter)

    return LetterResponse(
        id=letter.id,
        letter_type=letter.letter_type,
        condition_name=letter.condition_name,
        content=letter_content,
        advisory_notes=advisory_notes,
        created_at=letter.created_at.isoformat(),
    )


@router.get("/letters", response_model=list[LetterResponse])
async def list_letters(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_case(case_id, user, db)
    result = await db.execute(select(Letter).where(Letter.case_id == case_id).order_by(Letter.created_at))
    letters = result.scalars().all()
    return [
        LetterResponse(
            id=l.id,
            letter_type=l.letter_type,
            condition_name=l.condition_name,
            content=decrypt(l.content_encrypted),
            advisory_notes=l.advisory_notes,
            created_at=l.created_at.isoformat(),
        )
        for l in letters
    ]
