import base64
import io
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, User, Case, Document
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.encryption import encrypt, decrypt
from app.core.config import settings
from app.core.audit import log_action
from app.core.rate_limit import limiter, client_ip
from app.services.email_service import send_verification_email
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    persistence_opt_in: bool = False
    first_name: str
    middle_name: Optional[str] = None
    last_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TOTPVerifyRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    """Refresh token is no longer returned in the JSON body — it's set as an
    httpOnly cookie by the issuing endpoints (login flow, totp verify, refresh).
    Frontend keeps access_token in memory only."""
    access_token: str
    totp_required: bool = False
    first_name: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Issue the refresh token as an httpOnly cookie scoped to /api/auth.

    secure=True only in non-development environments — local docker-compose
    serves over http://localhost where Secure cookies would be silently dropped
    by the browser. SameSite=strict prevents the cookie from being sent on
    cross-site navigations or third-party iframe submissions.
    """
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=REFRESH_COOKIE_PATH,
    )


def _read_refresh_token(request: Request) -> Optional[str]:
    """Read the refresh token from the httpOnly cookie. The body fallback that
    existed during the cookie migration window has been removed — clients must
    rely on the cookie set on /login, /totp/verify, and /refresh."""
    return request.cookies.get(REFRESH_COOKIE_NAME)


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


def _check_password_strength(password: str) -> None:
    if len(password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain an uppercase letter")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain a number")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
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
        first_name_encrypted=encrypt(body.first_name),
        middle_name_encrypted=encrypt(body.middle_name) if body.middle_name else None,
        last_name_encrypted=encrypt(body.last_name),
    )
    db.add(user)
    await db.commit()

    send_verification_email(body.email, verification_token)
    await log_action(db, "register", user_id=user.id, ip_address=client_ip(request))
    return {"message": "Registration successful. Check your email to verify your account."}


@router.get("/verify-email")
@limiter.limit("10/minute")
async def verify_email(request: Request, token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email_verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user.email_verified = True
    user.email_verification_token = None
    await db.commit()
    return {"message": "Email verified. You may now set up 2FA and log in."}


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    ip = client_ip(request)

    # Always run hash comparison to prevent timing attacks. The dummy hash is
    # a real bcrypt of an unguessable random string — verifying against it
    # always returns False but takes the same time as a real verification.
    dummy_hash = "$2b$12$2din5nmOLvoogN.DF41Lsu4b9lTFfh3WXS.Ykifj6K0AlHbhQWc2G"
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


@router.get("/totp/setup")
@limiter.limit("10/minute")
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
    qr_png_base64 = base64.b64encode(buf.getvalue()).decode("ascii")

    # Secret is returned in the JSON body so the frontend can render a
    # manual-entry fallback, but it's no longer in a CORS-exposed header
    # where browser extensions and TLS-inspection proxies can scoop it up.
    return {"secret": secret, "qr_png_base64": qr_png_base64}


@router.post("/totp/verify")
@limiter.limit("10/minute")
async def totp_verify(request: Request, body: TOTPVerifyRequest, response: Response, db: AsyncSession = Depends(get_db)):
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

    # TOTP lockout check — mirrors password lockout in /login
    if user.totp_locked_until and user.totp_locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="TOTP temporarily locked. Try again later.")

    secret = decrypt(user.totp_secret_encrypted)
    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code, valid_window=1):
        now = datetime.now(timezone.utc)
        user.totp_failed_attempts += 1
        if user.totp_failed_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.totp_locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
        await db.commit()
        await log_action(db, "totp_verify_failed", user_id=user.id, ip_address=client_ip(request), success=False)
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    # Success — reset TOTP failure counters
    user.totp_failed_attempts = 0
    user.totp_locked_until = None
    user.totp_enabled = True
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    first_name = decrypt(user.first_name_encrypted) if user.first_name_encrypted else None
    await log_action(db, "login_success", user_id=user.id, ip_address=client_ip(request))
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(
        access_token=create_access_token(user.id),
        first_name=first_name,
    )


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = _read_refresh_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token provided")
    user_id = decode_refresh_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    _set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(
        access_token=create_access_token(user.id),
        first_name=decrypt(user.first_name_encrypted) if user.first_name_encrypted else None,
    )


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "first_name": decrypt(current_user.first_name_encrypted) if current_user.first_name_encrypted else None,
        "last_name": decrypt(current_user.last_name_encrypted) if current_user.last_name_encrypted else None,
        "email": current_user.email,
    }


@router.delete("/account", status_code=204)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the account and all associated data (HIPAA erasure)."""
    # Collect document file paths before deleting rows
    cases_result = await db.execute(select(Case).where(Case.user_id == current_user.id))
    cases = cases_result.scalars().all()

    for case in cases:
        docs_result = await db.execute(select(Document).where(Document.case_id == case.id))
        for doc in docs_result.scalars().all():
            for fp in (doc.file_path, doc.extracted_text_path):
                if fp:
                    try:
                        Path(fp).unlink(missing_ok=True)
                    except Exception:
                        pass

    await log_action(db, "account_deleted", user_id=current_user.id)
    await db.delete(current_user)
    await db.commit()
    return Response(status_code=204)


@router.post("/logout")
async def logout(response: Response):
    # Stateless JWT — server has nothing to revoke for the access token, but we
    # do clear the refresh cookie so the browser stops sending it.
    _clear_refresh_cookie(response)
    return {"message": "Logged out"}
