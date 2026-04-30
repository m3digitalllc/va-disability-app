# Secrets directory

Files here are mounted into containers via Docker Compose `secrets:`. Their
contents are **gitignored** — only this README and the empty `.gitkeep` are
tracked.

## Required files

Create one file per secret, with no trailing newline (a trailing newline gets
read as part of the value and breaks Fernet/JWT). Each file should contain
the same value the corresponding entry has in your local `.env`.

| File                          | Source / format                                    |
|-------------------------------|----------------------------------------------------|
| `postgres_password`           | Postgres user `vaapp` password                     |
| `anthropic_api_key`           | `sk-ant-...` API key from console.anthropic.com    |
| `encryption_key`              | 32-byte base64 Fernet key (e.g. `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) |
| `jwt_secret`                  | Random 32+ byte string (e.g. `openssl rand -hex 32`) |
| `jwt_refresh_secret`          | Different random 32+ byte string                   |
| `smtp_pass`                   | SMTP relay password (or empty file if using mailhog) |

## Quick bootstrap

```bash
cd va-disability-app
mkdir -p secrets
echo -n "$POSTGRES_PASSWORD"       > secrets/postgres_password
echo -n "$ANTHROPIC_API_KEY"       > secrets/anthropic_api_key
echo -n "$ENCRYPTION_KEY"          > secrets/encryption_key
echo -n "$JWT_SECRET"              > secrets/jwt_secret
echo -n "$JWT_REFRESH_SECRET"      > secrets/jwt_refresh_secret
echo -n "$SMTP_PASS"               > secrets/smtp_pass
chmod 0444 secrets/*
docker-compose up --build
```

## Local (non-Docker) development

`backend/app/core/config.py` checks the environment first, then falls back to
`/run/secrets/<name>`. Local `uvicorn app.main:app --reload` keeps reading
from `.env` unchanged — this directory only matters for the Compose deployment.
