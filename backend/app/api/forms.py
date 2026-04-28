"""Public VA form templates.

These endpoints serve the *blank* canonical PDFs published by the VA. They are
public-domain (17 U.S.C. § 105), do not contain any veteran PHI, and require no
authentication.

For *filled* forms (containing veteran-specific data), see the case-scoped
form endpoints under `/api/cases/{case_id}/form/...`.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

router = APIRouter(prefix="/api/forms", tags=["forms"])

# In-container path; the host directory `backend/data/forms/` is bind-mounted to
# `/app/data` per docker-compose.
FORMS_DIR = Path("/app/data/forms")

# Catalog of supported VA forms. Add an entry here + drop the PDF in FORMS_DIR
# to make a new form available — no other code changes required.
FORM_CATALOG: dict[str, dict] = {
    "21-526EZ": {
        "id": "21-526EZ",
        "filename": "VA-Form-21-526EZ.pdf",
        "title": "VA Form 21-526EZ",
        "subtitle": "Application for Disability Compensation and Related Compensation Benefits",
        "revision": "JAN 2026",
        "pages": 15,
        "description": (
            "The primary application for VA disability compensation. Use this form to file a new "
            "claim, claim an increased rating for a service-connected condition, or file a "
            "supplemental claim with new and relevant evidence. Supports the Fully Developed Claim "
            "(FDC), Standard, BDD, and IDES processes."
        ),
        "canonical_source": "https://www.vba.va.gov/pubs/forms/VBA-21-526EZ-ARE.pdf",
    },
}


@router.get("")
def list_forms() -> list[dict]:
    """Return the catalog of available VA forms with availability flags."""
    result = []
    for form_id, meta in FORM_CATALOG.items():
        path = FORMS_DIR / meta["filename"]
        result.append({**meta, "available": path.exists()})
    return result


@router.get("/{form_id}/pdf")
def get_form_pdf(form_id: str) -> Response:
    """Stream the blank canonical VA form PDF.

    The X-Frame-Options header is overridden to SAMEORIGIN so the frontend can
    embed the PDF in an iframe preview. Cross-origin embedding is still blocked.
    """
    meta = FORM_CATALOG.get(form_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Unknown form ID")

    path = FORMS_DIR / meta["filename"]
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Form file not installed. Expected at: data/forms/{meta['filename']}. "
                f"Download from: {meta['canonical_source']}"
            ),
        )

    return FileResponse(
        path,
        media_type="application/pdf",
        # Inline disposition lets the browser preview; the frontend sets the
        # Content-Disposition explicitly via a separate download attribute.
        headers={
            "Content-Disposition": f'inline; filename="{meta["filename"]}"',
            # Allow same-origin framing for the inline preview iframe.
            "X-Frame-Options": "SAMEORIGIN",
        },
    )
