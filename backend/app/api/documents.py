from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, Case, Document, User
from app.api.deps import get_current_user
from app.services.document_service import (
    store_document, sha256_checksum, extract_text_from_pdf, store_extracted_text
)
import uuid

router = APIRouter(prefix="/api/cases/{case_id}/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    processed: bool
    uploaded_at: str


async def _get_case(case_id: str, user: User, db: AsyncSession) -> Case:
    result = await db.execute(select(Case).where(Case.id == case_id, Case.user_id == user.id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_case(case_id, user, db)
    result = await db.execute(select(Document).where(Document.case_id == case_id))
    docs = result.scalars().all()
    return [
        DocumentResponse(
            id=d.id,
            original_filename=d.original_filename,
            processed=d.processed,
            uploaded_at=d.uploaded_at.isoformat(),
        )
        for d in docs
    ]


@router.post("", status_code=201, response_model=DocumentResponse)
async def upload_document(
    case_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_case(case_id, user, db)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload PDF or image.")

    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")

    file_id = str(uuid.uuid4())
    checksum = sha256_checksum(data)
    file_path = store_document(file_id, data)

    # Extract text from PDF
    text_path = None
    processed = False
    if file.content_type == "application/pdf":
        text = extract_text_from_pdf(data)
        if text.strip():
            text_path = store_extracted_text(file_id, text)
            processed = True

    doc = Document(
        id=file_id,
        case_id=case_id,
        original_filename=file.filename,
        file_path=file_path,
        file_checksum=checksum,
        extracted_text_path=text_path,
        processed=processed,
    )
    db.add(doc)
    await db.commit()

    return DocumentResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        processed=doc.processed,
        uploaded_at=doc.uploaded_at.isoformat(),
    )


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    case_id: str,
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_case(case_id, user, db)
    result = await db.execute(select(Document).where(Document.id == doc_id, Document.case_id == case_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
