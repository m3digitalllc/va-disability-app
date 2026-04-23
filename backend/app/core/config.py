from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str
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


settings = Settings()
