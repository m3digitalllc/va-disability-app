import hashlib
import os
from pathlib import Path
from app.core.config import settings
from app.core.encryption import encrypt_file, decrypt_file


def _doc_dir() -> Path:
    p = Path(settings.DOCUMENTS_PATH)
    p.mkdir(parents=True, exist_ok=True)
    return p


def store_document(file_id: str, data: bytes) -> str:
    """Encrypt and write file to disk. Returns relative path."""
    encrypted = encrypt_file(data)
    path = _doc_dir() / f"{file_id}.enc"
    path.write_bytes(encrypted)
    return str(path)


def retrieve_document(file_path: str) -> bytes:
    """Read and decrypt file from disk."""
    return decrypt_file(Path(file_path).read_bytes())


def sha256_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract_text_from_pdf(data: bytes) -> str:
    """Extract plain text from PDF bytes using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=data, filetype="pdf")
        return "\n\n".join(page.get_text() for page in doc)
    except Exception:
        return ""


def store_extracted_text(file_id: str, text: str) -> str:
    """Encrypt and store extracted text. Returns path."""
    encrypted = encrypt_file(text.encode())
    path = _doc_dir() / f"{file_id}_text.enc"
    path.write_bytes(encrypted)
    return str(path)


def retrieve_extracted_text(text_path: str) -> str:
    """Decrypt and return extracted text."""
    return decrypt_file(Path(text_path).read_bytes()).decode()
