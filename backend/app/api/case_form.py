"""Case-scoped 21-526EZ form endpoints.

Contrast with `forms.py`, which serves blank public-domain VA PDFs. These
endpoints deal with *filled* form data for a specific veteran's case: merged
auto-populated data from User/VeteranProfile/ServicePay/Assessment plus any
manual overrides the veteran has made.
"""

from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import get_db, User
from app.api.deps import get_current_user
from app.core.audit import log_action
from app.core.rate_limit import client_ip
from app.services.claim_form_service import assemble_form_data, save_form_overrides
from app.services.claim_form_filler import fill_form_21_526ez

router = APIRouter(prefix="/api/cases/{case_id}/form/21-526ez", tags=["case-form"])

BLANK_PDF_PATH = Path("/app/data/forms/VA-Form-21-526EZ.pdf")


class FormOverridesRequest(BaseModel):
    overrides: dict


@router.get("")
async def get_form(
    request: Request,
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the merged 21-526EZ form data for this case, plus metadata the
    UI needs to render source badges and a completion indicator:

    - `data`     — merged values (auto + overrides) to display/edit
    - `auto`     — auto-populated values only (for computing source badges)
    - `overrides` — current user overrides
    - `completion` — per-section + overall completion statistics
    """
    result = await assemble_form_data(case_id, user, db)
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found")
    await log_action(
        db, "form_read", user_id=user.id, resource_type="case",
        resource_id=case_id, ip_address=client_ip(request),
    )
    return result


@router.put("")
async def update_form(
    request: Request,
    case_id: str,
    body: FormOverridesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the override map for this case. The frontend sends the full
    overrides object; atomic merge/diff is done there.
    """
    ok = await save_form_overrides(case_id, user, db, body.overrides)
    if not ok:
        raise HTTPException(status_code=404, detail="Case not found")
    await log_action(
        db, "form_updated", user_id=user.id, resource_type="case",
        resource_id=case_id, ip_address=client_ip(request),
    )
    # Return the freshly-merged state so the UI stays in sync
    return await assemble_form_data(case_id, user, db)


async def _build_filled_pdf(case_id: str, user: User, db: AsyncSession) -> bytes:
    result = await assemble_form_data(case_id, user, db)
    if result is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if not BLANK_PDF_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Blank form template not installed. Expected at "
                f"{BLANK_PDF_PATH.name} in backend/data/forms/."
            ),
        )

    blank_bytes = BLANK_PDF_PATH.read_bytes()
    return fill_form_21_526ez(blank_bytes, result["data"])


@router.get("/pdf")
async def download_filled_pdf(
    request: Request,
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return the official VA Form 21-526EZ filled with this case's data,
    as a downloadable attachment.

    Empty fields stay blank — partial data produces a partial form ready for
    the veteran to complete by hand. The PDF format is byte-identical to the
    VA's published version (we only write values into existing AcroForm
    fields; we never re-render the layout).
    """
    filled_bytes = await _build_filled_pdf(case_id, user, db)
    await log_action(
        db, "form_pdf_downloaded", user_id=user.id, resource_type="case",
        resource_id=case_id, ip_address=client_ip(request),
    )
    return Response(
        content=filled_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="VA-Form-21-526EZ-case-{case_id[:8]}.pdf"',
            # Filled forms contain PHI — disable cross-origin framing and caching
            "X-Frame-Options": "SAMEORIGIN",
            "Cache-Control": "no-store",
        },
    )


@router.get("/pdf/preview")
async def preview_filled_pdf(
    request: Request,
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return the filled PDF inline for in-browser preview (no download
    prompt). Same content as `/pdf`; only the Content-Disposition differs.
    Same-origin framing is allowed so the form page can iframe-embed this.
    """
    filled_bytes = await _build_filled_pdf(case_id, user, db)
    await log_action(
        db, "form_pdf_previewed", user_id=user.id, resource_type="case",
        resource_id=case_id, ip_address=client_ip(request),
    )
    return Response(
        content=filled_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "X-Frame-Options": "SAMEORIGIN",
            "Cache-Control": "no-store",
        },
    )
