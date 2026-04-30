import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer,
    String, Text, JSON,
)
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
    totp_failed_attempts = Column(Integer, default=0, nullable=False)
    totp_locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Legal name — collected at registration, encrypted PHI
    first_name_encrypted = Column(String, nullable=True)
    middle_name_encrypted = Column(String, nullable=True)
    last_name_encrypted = Column(String, nullable=True)

    cases = relationship("Case", back_populates="user", cascade="all, delete-orphan")
    veteran_profile = relationship("VeteranProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    service_pay = relationship("ServicePay", back_populates="user", uselist=False, cascade="all, delete-orphan")


class VeteranProfile(Base):
    """
    Captures structured data from VA Form 21-526EZ.
    Sections: Contact, Homeless, Service Records, Exposure, Claim Info.
    Excludes SSN, DOB, phone_international, and direct deposit per product decision.
    """
    __tablename__ = "veteran_profiles"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # ── Personal Identification (526EZ Section I, partial) ─────────────────────
    va_file_number = Column(String, nullable=True)
    service_number_dod_id = Column(String, nullable=True)
    prior_va_claim = Column(Boolean, nullable=True)

    # ── Contact Information (526EZ Section I, continued) ──────────────────────
    phone_number_encrypted = Column(String, nullable=True)         # PHI
    address_street_encrypted = Column(String, nullable=True)       # PHI
    address_apt = Column(String, nullable=True)
    address_city = Column(String, nullable=True)
    address_state = Column(String, nullable=True)
    address_zip = Column(String, nullable=True)
    address_country = Column(String, nullable=True)
    consent_electronic_correspondence = Column(Boolean, nullable=True)
    is_va_employee = Column(Boolean, nullable=True)

    # ── Homeless Information (526EZ Section III) ───────────────────────────────
    currently_homeless = Column(Boolean, nullable=True)
    homeless_situation = Column(String, nullable=True)
    at_risk_of_homeless = Column(Boolean, nullable=True)
    at_risk_situation = Column(String, nullable=True)
    homeless_poc_name_encrypted = Column(String, nullable=True)    # PHI
    homeless_poc_phone_encrypted = Column(String, nullable=True)   # PHI

    # ── Service Records (526EZ Section VI) ────────────────────────────────────
    # JSON array — each element represents one period of service:
    # { branch, component, entry_date, exit_date, place_of_separation,
    #   served_under_other_name, other_name, combat_zone_post_911,
    #   pow_status, pow_confinement_from, pow_confinement_to,
    #   reserve_ng, reserve_component, reserve_from, reserve_to,
    #   reserve_unit_name, reserve_unit_address, reserve_unit_phone,
    #   currently_activated, activation_date, anticipated_separation_date,
    #   inactive_duty_training_pay }
    service_records = Column(JSON, nullable=True)

    # ── Exposure Information (526EZ Section IV) ───────────────────────────────
    # JSON object:
    # { toxic_exposure_claimed, gulf_war_service, gulf_war_locations,
    #   gulf_war_from, gulf_war_to, herbicide_exposure, herbicide_locations,
    #   herbicide_other_locations, herbicide_from, herbicide_to,
    #   asbestos, mustard_gas, radiation, shad, mos_toxin,
    #   camp_lejeune_water, other_exposure, exposure_from, exposure_to,
    #   additional_exposure_notes }
    exposure_data = Column(JSON, nullable=True)

    # ── Claim Program (526EZ Section I, Item 1) ───────────────────────────────
    claim_program_type = Column(String, nullable=True)             # FDC | Standard | IDES | BDD
    bdd_anticipated_release_date = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    user = relationship("User", back_populates="veteran_profile")


class ServicePay(Base):
    """Captures 526EZ Section VII — Service Pay data."""
    __tablename__ = "service_pay"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    receiving_retired_pay = Column(Boolean, nullable=True)
    future_retired_pay = Column(Boolean, nullable=True)
    retired_pay_branch = Column(String, nullable=True)
    retired_pay_monthly_amount_encrypted = Column(String, nullable=True)   # PHI
    retired_status = Column(String, nullable=True)                         # retired_list | permanent_disability | temp_disability
    waive_va_for_retired_pay = Column(Boolean, nullable=True)
    separation_pay_received = Column(Boolean, nullable=True)
    separation_pay_date = Column(String, nullable=True)
    separation_pay_branch = Column(String, nullable=True)
    separation_pay_amount_encrypted = Column(String, nullable=True)        # PHI
    waive_va_for_training_pay = Column(Boolean, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    user = relationship("User", back_populates="service_pay")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False, default="My Claim")
    status = Column(String, default="draft", nullable=False)       # draft | in_progress | complete
    assessment_result_encrypted = Column(Text, nullable=True)
    current_phase = Column(Integer, default=1, nullable=False)
    claim_program_type = Column(String, nullable=True)
    # User edits that override auto-populated 21-526EZ form values.
    # Schema mirrors the assembled form data; leaf-level overrides for atomic
    # fields and full-array replacement for list fields (claims, service_records).
    form_overrides = Column(JSON, nullable=True)
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
    review_summary_encrypted = Column(Text, nullable=True)   # cached agent review
    review_status = Column(String, default="unreviewed", nullable=False)  # unreviewed|reviewing|reviewed|failed
    uploaded_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    case = relationship("Case", back_populates="documents")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)                          # user | assistant
    content_encrypted = Column(Text, nullable=False)
    phase = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    case = relationship("Case", back_populates="messages")


class Letter(Base):
    __tablename__ = "letters"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    letter_type = Column(String, nullable=False)                   # provider | personal | buddy
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
        # Idempotent column additions for tables that predate new model fields.
        # Safe to run on every startup — ADD COLUMN IF NOT EXISTS is a no-op when
        # the column already exists.
        migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name_encrypted VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name_encrypted VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_encrypted VARCHAR",
            "ALTER TABLE cases ADD COLUMN IF NOT EXISTS claim_program_type VARCHAR",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_summary_encrypted TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_status VARCHAR DEFAULT 'unreviewed'",
            "ALTER TABLE cases ADD COLUMN IF NOT EXISTS form_overrides JSONB",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_failed_attempts INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_locked_until TIMESTAMP WITH TIME ZONE",
        ]
        for sql in migrations:
            await conn.execute(__import__("sqlalchemy").text(sql))
