import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer,
    String, Text, JSON, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    totp_secret_encrypted = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False)
    persistence_opt_in = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    cases = relationship("Case", back_populates="user", cascade="all, delete-orphan")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False, default="My Claim")
    status = Column(String, default="draft", nullable=False)  # draft | in_progress | complete
    # assessment JSON stored encrypted as string
    assessment_result_encrypted = Column(Text, nullable=True)
    current_phase = Column(Integer, default=1, nullable=False)  # 1-5
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    user = relationship("User", back_populates="cases")
    documents = relationship("Document", back_populates="case", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="case", cascade="all, delete-orphan", order_by="Message.created_at")
    letters = relationship("Letter", back_populates="case", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_checksum = Column(String, nullable=False)
    extracted_text_path = Column(String, nullable=True)
    processed = Column(Boolean, default=False, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    case = relationship("Case", back_populates="documents")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # user | assistant
    content_encrypted = Column(Text, nullable=False)
    phase = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    case = relationship("Case", back_populates="messages")


class Letter(Base):
    __tablename__ = "letters"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    letter_type = Column(String, nullable=False)  # provider | personal | buddy
    condition_name = Column(String, nullable=False)
    content_encrypted = Column(Text, nullable=False)
    advisory_notes = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    case = relationship("Case", back_populates="letters")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    success = Column(Boolean, default=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_now, nullable=False, index=True)


# Async engine + session factory
engine = create_async_engine(settings.DATABASE_URL, echo=settings.ENVIRONMENT == "development")
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session_factory() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
