from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.encryption import _get_fernet
from app.core.rate_limit import limiter
from app.core.security import create_access_token, decode_access_token
from app.models.database import create_tables
from app.api import auth, cases, documents, chat, letters, veteran_profile, profile_chat, forms, case_form


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()

    # Eagerly validate ENCRYPTION_KEY and JWT secrets at startup so a
    # misconfiguration fails fast instead of crashing on the first request.
    try:
        _get_fernet()  # raises if ENCRYPTION_KEY is malformed
    except Exception as exc:  # pragma: no cover — startup-only path
        raise RuntimeError(
            f"ENCRYPTION_KEY is invalid or missing: {exc}. Provide a valid "
            "Fernet key (32-byte base64) via env or /run/secrets/encryption_key."
        ) from exc

    try:
        _probe = create_access_token("startup-probe")
        if decode_access_token(_probe) != "startup-probe":
            raise RuntimeError("JWT round-trip mismatch")
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            f"JWT_SECRET round-trip failed at startup: {exc}. Provide a valid "
            "secret via env or /run/secrets/jwt_secret."
        ) from exc

    yield


app = FastAPI(
    title="VA Claims Assistant API",
    docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — restrict to frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# Security headers middleware
def _is_pdf_route(path: str) -> bool:
    """Routes that serve PDFs the frontend may embed in same-origin iframes."""
    if path.startswith("/api/forms"):
        return True
    # Filled 21-526EZ preview / download (case-scoped, contains PHI but
    # framed only same-origin via the form review page's blob URL approach).
    if path.startswith("/api/cases/") and "/form/21-526ez/pdf" in path:
        return True
    return False


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    # PDF routes set their own X-Frame-Options per-response (SAMEORIGIN) so
    # the preview iframe works. All other responses get the global DENY.
    # CSP frame-ancestors 'self' (set by nginx in production) is the
    # authoritative framing policy; X-Frame-Options is the fallback.
    if not _is_pdf_route(request.url.path):
        response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Routers
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(letters.router)
app.include_router(veteran_profile.router)
app.include_router(profile_chat.router)
app.include_router(forms.router)
app.include_router(case_form.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
