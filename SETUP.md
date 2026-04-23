# VA Claims Assistant — Setup Guide

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes docker-compose)
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)

---

## First-Time Setup

### 1. Generate secrets

Run these commands (requires Python 3):

```bash
# Fernet encryption key (for PHI at rest)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# JWT secrets (run twice — one for access, one for refresh)
python -c "import secrets; print(secrets.token_hex(64))"
python -c "import secrets; print(secrets.token_hex(64))"
```

### 2. Create .env

```bash
cd va-disability-app
cp .env.example .env
```

Edit `.env` and fill in:
```
ANTHROPIC_API_KEY=sk-ant-...
POSTGRES_PASSWORD=<strong password>
ENCRYPTION_KEY=<output from fernet command above>
JWT_SECRET=<first hex output>
JWT_REFRESH_SECRET=<second hex output>
```

For email verification in dev, you can leave SMTP fields blank — verification links will print to the backend container logs instead.

### 3. (HTTPS) Generate self-signed cert for local dev

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem \
  -out nginx/certs/cert.pem \
  -subj "/CN=localhost"
```

Skip this if you only want to run backend+frontend directly without nginx (dev mode below).

### 4. Start the stack

**Full stack with nginx (recommended):**
```bash
docker-compose up --build
```

**Dev mode (no nginx, no HTTPS required):**
```bash
docker-compose up --build db backend frontend
```

App will be available at:
- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/api/docs
- Full stack via nginx: https://localhost

---

## Development Workflow

### Backend only (hot reload)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Requires a local PostgreSQL instance or forward the Docker DB port:
```bash
docker-compose up db  # then run uvicorn locally
```

### Frontend only (hot reload)
```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

---

## First Run — User Flow

1. Open http://localhost:3000
2. Click **Get Started** → Register with email + password
3. In dev mode: check backend container logs for the email verification link
   ```bash
   docker-compose logs backend | grep "Email verification link"
   ```
4. Click the verification link → sets `email_verified = true`
5. Sign in → you'll be prompted to scan a QR code with Google Authenticator / Authy
6. Enter the 6-digit TOTP code → you're in
7. Click **New Claim** on the dashboard to start

---

## Skills Configuration

The `skills/` directory from the parent folder is mounted read-only into the backend container at `/app/skills`. If you move or rename the skills directory, update the volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ../skills:/app/skills:ro   # adjust path here
```

The `SKILLS_PATH` env var in the backend defaults to `/app/skills`.

---

## Production Deployment Checklist

Before going live:
- [ ] Replace self-signed cert with a real TLS cert (Let's Encrypt / ACM)
- [ ] Set `ENVIRONMENT=production` in `.env` (disables API docs)
- [ ] Point `DOCUMENTS_PATH` to persistent encrypted storage (or S3 + BAA)
- [ ] Sign a HIPAA BAA with your cloud provider
- [ ] Enable automated database backups
- [ ] Set up audit log retention policy (HIPAA requires 6 years)
- [ ] Configure SMTP for real email delivery
- [ ] Add ID.me or Login.gov for identity proofing (optional upgrade)

---

## Troubleshooting

**Backend won't start:** Check `ENCRYPTION_KEY` is a valid Fernet key (base64-encoded 32 bytes). Use the generation command above.

**"Email not verified" after clicking link:** The token may have expired or the frontend URL in `.env` doesn't match where you're running. Verify `FRONTEND_URL` matches your actual URL.

**QR code not showing on 2FA setup:** Check the backend logs for errors. Ensure `qrcode` and `Pillow` are installed (they are in Docker).

**Assessment returns no results:** Ensure at least one document was uploaded AND shows "Processed" status. Only PDFs are auto-processed; image OCR requires `tesseract` installed in the container (not included by default — add `tesseract-ocr` to the Dockerfile apt install if needed).
