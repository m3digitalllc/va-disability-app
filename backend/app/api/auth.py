import secrets
import io
from datetime import datetime, timezone, timedelta
from typing import Optional
import pyotp
import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.encryption import encrypt, decrypt
from app.core.config import settings
from app.core.audit import log_action
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    persistence_opt_in: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TOTPVerifyRequest(BaseModel):
    code: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    totp_required: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


def _check_password_strength(password: str) -> None:
    if len(password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain an uppercase letter")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain a number")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_password_strength(body.password)

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    verification_token = secrets.token_urlsafe(32)
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        email_verification_token=verification_token,
        persistence_opt_in=body.persistence_opt_in,
    )
    db.add(user)
    await db.commit()

    send_verification_email(body.email, verification_token)
    await log_action(db, "register", user_id=user.id, ip_address=_client_ip(request))
    return {"message": "Registration successful. Check your email to verify your account."}


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email_verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.email_verified = True
    user.email_verification_token = None
    await db.commit()
    return {"message": "Email verified. You may now set up 2FA and log in."}


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    ip = _client_ip(request)

    # Always run hash comparison to prevent timing attacks
    dummy_hash = "$2b$12$invalidhashfortimingprotection000000000000000000000000"
    password_ok = verify_password(body.password, user.password_hash if user else dummy_hash)

    if not user or not password_ok:
        if user:
            now = datetime.now(timezone.utc)
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
            await db.commit()
        await log_action(db, "login_failed", ip_address=ip, success=False)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="Account temporarily locked. Try again later.")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    # Reset failed attempts on successful password check
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    # If TOTP not yet set up, return partial auth token scoped only for TOTP setup
    if not user.totp_enabled:
        setup_token = create_access_token(user.id)  # limited use — TOTP setup only
        await log_action(db, "login_password_ok_totp_pending", user_id=user.id, ip_address=ip)
        return {"totp_required": False, "totp_setup_required": True, "setup_token": setup_token}

    # TOTP enabled — return partial token requiring TOTP verification
    partial_token = create_access_token(user.id)
    await log_action(db, "login_password_ok_awaiting_totp", user_id=user.id, ip_address=ip)
    return {"totp_required": True, "partial_token": partial_token}


@router.post("/totp/setup")
async def totp_setup(request: Request, db: AsyncSession = Depends(get_db)):
    """Generate a TOTP secret and return QR code for enrollment."""
    from app.api.deps import bearer
    from fastapi.security import HTTPAuthorizationCredentials
    auth = await bearer(request)
    from app.core.security import decode_access_token
    user_id = decode_access_token(auth.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    secret = pyotp.random_base32()
    user.totp_secret_encrypted = encrypt(secret)
    await db.commit()

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="VA Claims Assistant")

    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png", headers={
        "X-TOTP-Secret": secret,  # also return secret for manual entry
    })


@router.post("/totp/verify")
async def totp_verify(body: TOTPVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Verify TOTP code. On success, enable TOTP and issue full JWT pair."""
    from app.api.deps import bearer
    auth = await bearer(request)
    from app.core.security import decode_access_token
    user_id = decode_access_token(auth.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.totp_secret_encrypted:
        raise HTTPException(status_code=400, detail="TOTP not configured")

    secret = decrypt(user.totp_secret_encrypted)
    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code, valid_window=1):
        await log_action(db, "totp_verify_failed", user_id=user.id, ip_address=_client_ip(request), success=False)
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    user.totp_enabled = True
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    await log_action(db, "login_success", user_id=user.id, ip_address=_client_ip(request))
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh")
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_id = decode_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout")
async def logout():
    # Client discards tokens; stateless JWT — nothing to invalidate server-side in MVP
    return {"message": "Logged out"}
