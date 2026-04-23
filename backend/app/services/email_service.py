import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


def send_verification_email(to_email: str, token: str) -> None:
    if not settings.SMTP_HOST:
        # Dev mode: print link to console
        print(f"[DEV] Email verification link: {settings.FRONTEND_URL}/auth/verify-email?token={token}")
        return

    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your VA Claims Assistant account"
    msg["From"] = settings.SMTP_USER
    msg["To"] = to_email

    html = f"""
    <html><body>
    <h2>Verify your email</h2>
    <p>Click the link below to verify your email address and activate your account.</p>
    <p><a href="{verify_url}" style="background:#1d4ed8;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
        Verify Email
    </a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create this account, ignore this email.</p>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
