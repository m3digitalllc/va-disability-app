import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings


SECRETS_DIR = Path("/run/secrets")


def _secret_or_file(name: str, default: Optional[str] = None) -> Optional[str]:
    """Resolve a secret value with a fallback chain that supports both local
    dev (env / .env file) and Docker Compose `secrets:` (file mount under
    /run/secrets/<name>):

    1. If the environment variable is set, use it. Local `uvicorn app.main:app`
       development reads from a `.env` file via pydantic-settings, which
       populates os.environ before this is called.
    2. Otherwise, if `/run/secrets/<lowercase-name>` exists, read its content.
       Docker Compose mounts each declared secret as a file at that path.
    3. Otherwise, fall through to the supplied default (or None).
    """
    val = os.environ.get(name)
    if val is not None:
        return val

    secret_file = SECRETS_DIR / name.lower()
    if secret_file.is_file():
        try:
            return secret_file.read_text().strip()
        except Exception:
            return default
    return default


class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None
    DB_HOST: str = "db"
    DB_PORT: int = 5432
    DB_NAME: str = "vadisability"
    DB_USER: str = "vaapp"
    POSTGRES_PASSWORD: Optional[str] = None
    ANTHROPIC_API_KEY: str
    ENCRYPTION_KEY: str
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    DOCUMENTS_PATH: str = "./data/documents"
    ENVIRONMENT: str = "development"

    # JWT expiry
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Auth hardening
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

    # Skills directory (mounted from parent)
    SKILLS_PATH: str = "/app/skills"

    class Config:
        env_file = ".env"


# Pre-resolve secrets that may live in /run/secrets (Compose deployments)
# so Pydantic-settings sees them as if they were environment variables.
# Local uvicorn dev keeps working unchanged because .env populates os.environ
# first; this only kicks in for keys not already in env.
for _key in (
    "ANTHROPIC_API_KEY",
    "ENCRYPTION_KEY",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "SMTP_PASS",
    "POSTGRES_PASSWORD",
):
    _val = _secret_or_file(_key)
    if _val is not None and _key not in os.environ:
        os.environ[_key] = _val

settings = Settings()

# If DATABASE_URL wasn't supplied directly (Compose secrets path), assemble it
# from components + the file-mounted password. Local dev with a `.env` containing
# DATABASE_URL keeps working as before.
if not settings.DATABASE_URL:
    if not settings.POSTGRES_PASSWORD:
        raise RuntimeError(
            "Neither DATABASE_URL nor POSTGRES_PASSWORD is set. "
            "Provide DATABASE_URL in .env, or mount /run/secrets/postgres_password."
        )
    settings.DATABASE_URL = (
        f"postgresql+asyncpg://{settings.DB_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )
