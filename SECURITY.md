<!-- ============================================================ -->
<!-- AUTO-GENERATED FROM .security-context.yaml                   -->
<!-- DO NOT EDIT THIS SECTION DIRECTLY.                           -->
<!-- Edit the YAML and re-run the security-context-setup skill.   -->
<!-- ============================================================ -->
<!-- schema_version: 1.1                                          -->
<!-- generated_at: 2026-04-29T00:00:00Z                           -->
<!-- generated_from_hash: 0ebb41ebeeb4                            -->
<!-- ============================================================ -->

# Security Context: va-claims-assistant

> Conducts an interview and reviews uploaded medical documentation to estimate the VA disability rating a service member may be eligible for, and produces nexus letters establishing service connection for specified disabilities.

This document is the security context for this project. It is generated from
`.security-context.yaml` and is the canonical reference for any security
audit, code review, or incident response activity. If this document is out of
date, regenerate it by running the `security-context-setup` skill.

---

## At a Glance

| Field | Value |
|---|---|
| **Lifecycle stage** | prototype |
| **Exposure** | local_only |
| **Publicly reachable** | no |
| **Primary stack** | python / fastapi |
| **User population** | internal_only |
| **Compliance regimes** | HIPAA (in_progress, role n_a), CCPA/CPRA (in_progress, secondary), SOC2 (in_progress, secondary) |
| **Last reviewed** | 2026-04-29 |
| **Review cadence** | every 90 days |

---

## 1. Project Identity

- **Name:** va-claims-assistant
- **Description:** Conducts an interview and reviews uploaded medical documentation to estimate the VA disability rating a service member may be eligible for, and produces nexus letters establishing service connection for specified disabilities.
- **Repository:** https://github.com/m3digitalllc/va-disability-app.git
- **Primary language:** python
- **Primary framework:** fastapi

---

## 2. Lifecycle and Deployment

- **Current stage:** prototype
- **Publicly reachable:** no
- **Exposure model:** local_only

### Deployment Targets

- **development** on other

---

## 3. Data Handling

### Data Categories

This section describes which sensitive data categories the application
touches, and whether the data is **stored** (held in the app's own systems)
or **processed via a third party** (passes through but isn't held).

| Category | Stored | Processed via 3rd Party | Provider |
|---|---|---|---|
| Auth credentials | yes | no | — |
| Payment data | no | no | — |
| Government identifiers | no | no | — |
| Health information | yes | yes | anthropic |
| Precise location | no | no | — |
| Biometric data | no | no | — |
| Children's data | no | no | — |
| Communications content | yes | yes | anthropic |
| Financial records | no | no | — |
| Employment / HR data | yes | no | — |
| Legal / privileged | no | no | — |
| Proprietary business data | no | no | — |

### User Population Size

Approximately under_100 users.

### Data Residency

- **us**: must remain in jurisdiction

---

## 4. Regulatory Compliance

### HIPAA

- **Status:** in_progress
- **Role:** n_a
- **Notes:** Role declared n_a per operator: app is consumer-facing and operator is not a covered entity or business associate. PHI is handled voluntarily with HIPAA-grade safeguards as a posture choice. `status=in_progress + role=n_a` flagged as inconsistent in `_setup_warnings_overridden`.

### CCPA / CPRA

- **Status:** in_progress
- **Role:** secondary

### SOC 2

- **Status:** in_progress
- **Role:** secondary

---

## 5. Authentication and Identity

- **User population:** internal_only
- **Authentication methods:** email_password, mfa_totp
- **MFA:** optional
- **Has admin role:** no

### Session Management

- **Storage:** httponly_cookies
- **Timeout:** 15 minutes (access token); 7-day refresh token per `app/core/config.py`

> ⚠ Storing JWT tokens in `localStorage` makes them readable by any XSS payload and pairs poorly with a 7-day refresh window. Strongly recommend migrating to `httponly_cookies` before B1 (lifecycle stage) advances toward `public_production`.

---

## 6. External Integrations and Trust Boundaries

### Paid External APIs

- **Has paid APIs:** yes
- **Services:** anthropic

### Webhooks Received

- **Receives webhooks:** no

### Server-Fetched URLs (SSRF Surface)

- **Fetches user-supplied URLs:** no *(resolved from code: no `httpx.get` / `AsyncClient` call sites in `backend/`; `httpx` is a transitive dep of the Anthropic SDK)*

### File Uploads

- **Accepts uploads:** yes
- **Visibility:** private

### LLM / AI with User Input

- **Has LLM with user input:** yes
- **Has tool use:** no *(resolved from code: `services/claude_service.py` calls `messages.stream/create` with no `tools=` parameter)*
- **Tool capabilities:** none
- **Output rendering:** markdown_sanitized *(resolved from code: `react-markdown` v9 used in `frontend/components/chat/StreamingChat.tsx` with no plugin props; no `rehype-raw` / `dangerouslySetInnerHTML` anywhere in `frontend/`)*

---

## 7. Infrastructure and Out-of-Band Controls

- **WAF / CDN filtering:** no
- **Network access restrictions:** private_network_only
- **Operational logging:** unknown ⚠ pending review
- **Audit logging:** sensitive_data_access *(`log_action()` is wired into every PHI read/write across cases, documents, letters, chat, veteran_profile, profile_chat, case_form. AuditLog table remains plain SQLAlchemy — not yet append-only/immutable.)*
- **Secret storage:** dotenv_on_servers *(declared honestly per the schema enum; in practice, Compose deployments now use file-mounted secrets at `/run/secrets/*` while local `uvicorn` dev still reads `.env`. Plan to migrate to a managed secret manager — AWS Secrets Manager / SOPS / Doppler / 1Password CLI — before any non-prototype exposure.)*

> Compose deployments now mount secrets as files at `/run/secrets/*` (see `secrets/README.md`); the schema enum doesn't yet have a value that captures this pattern, so `dotenv_on_servers` is the most accurate option available. Migrate to a managed secret manager (`cloud_secret_manager`) before public exposure.

- **Infrastructure-as-code present:** yes (docker_compose)

---

## 8. Threat Actor Model

This project is audited against the following threat actors. The audit skill
weights findings according to which actors are in scope.

**Always in scope** (not optional): opportunistic automated scanners.

**Additional actors in scope for this project:**

- Authenticated users targeting other users' data
- Authenticated users attempting privilege escalation
- Financially motivated attackers (PHI is high-value on dark markets)
- Targeted attackers with specific interest (stalking risk for veterans, foreign intelligence interest in service members)

### Prior Incidents

None declared.

---

## 9. Operational Context

- **Team size:** solo
- **AI-assisted development:** primary
- **Deployment cadence:** rarely

---

## 10. Disclosure

- **Security contact:** *Not specified.* ⚠ pending review

> ⚠ Add a security contact email before lifecycle.publicly_reachable advances to `yes`. Required for responsible-disclosure intake when the app is reachable from the internet.

- **Security.txt path:** `/.well-known/security.txt`

---

## 11. Audit Configuration

### Scope

- **Included paths:** `./`
- **Excluded paths:** `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `vendor/`, `__tests__/fixtures/`

### Auto-Run Behavior

- **Auto-run SAST skill if available:** false
- **Auto-run dynamic skill:** false *(always false; dynamic audits require explicit invocation)*

### History

Audit reports are persisted in `.security-audits/` (gitignored by default).

### Acknowledged Findings

*No findings have been explicitly acknowledged.*

---

## 12. Pending Review

The following fields were deferred during context setup. Audit findings
related to these areas will assume worst-case context until resolved.

- `infrastructure.centralized_logging`
- `disclosure.security_contact_email`

To resolve, re-run the `security-context-setup` skill.

> **Sanity check:** Both fields above correspond to questions that were
> explicitly asked during intake (Phase 2, Sections G3 and J1) and the
> operator chose to defer with "unknown" / "later". This list is valid.

---

<!-- ============================================================ -->
<!-- HUMAN-AUTHORED CONTENT BELOW THIS LINE                       -->
<!-- The setup skill will preserve everything below this marker   -->
<!-- across regenerations. Use this section for narrative threat  -->
<!-- model notes, architectural decisions, or other context that  -->
<!-- doesn't fit cleanly into the structured schema.              -->
<!-- ============================================================ -->

## Threat Model Narrative

### Remediation completed (2026-04-29)

The 18-finding audit run on 2026-04-29 (see
`.security-audits/audit-2026-04-29T22-44-07Z.{yaml,md}`) drove a 9-phase
remediation pass. Highlights:

- **Refresh token migration**: refresh JWT now lives in an httpOnly + Secure
  + SameSite=Strict cookie scoped to `Path=/api/auth`; access tokens are kept
  in a frontend module variable in memory only — never web storage. (Closes
  `auth-localstorage-session-005`.)
- **Rate limiting**: SlowAPI `@limiter.limit("100/minute")` decorators on
  every Anthropic-calling and auth endpoint. Initial limit is generous;
  tighten in a follow-up to `5–20/minute` per route once fully tested.
  (Closes `rate-paid-api-no-limit-001`, `rate-auth-no-limit-002`.)
- **TOTP lockout**: new `users.totp_failed_attempts` + `totp_locked_until`
  columns; mirrors the password-lockout pattern; threshold `MAX_LOGIN_ATTEMPTS`
  shared with password lockout. (Closes `auth-totp-no-failure-lockout`.)
- **TOTP setup**: `X-TOTP-Secret` response header is gone; secret + QR PNG
  are returned in the JSON body as `{secret, qr_png_base64}`. (Closes
  `auth-totp-secret-leak-via-header`.)
- **Audit logging**: `log_action()` now fires on every PHI read/write
  (cases, documents, letters, chat, veteran_profile, profile_chat,
  case_form). Audit-during-streaming-chat uses its own `async_session_factory`
  to avoid double-commit on the request-scoped session. (Closes
  `audit-logging-phi-access-001`.)
- **Compose secrets**: `docker-compose.yml` now mounts secrets as files at
  `/run/secrets/*`; `backend/app/core/config.py` reads via `_secret_or_file()`
  (env first → file fallback) so `uvicorn app.main:app` from `backend/` keeps
  working with `.env`. `DATABASE_URL` is assembled from components +
  POSTGRES_PASSWORD at startup so the password is never in any container env
  block. (Closes `iac-docker-compose-secrets`.)
- **Container hardening**: backend runs as `vaapp` (uid 1000), frontend as
  `node`; both with `read_only: true`, `cap_drop: ["ALL"]`,
  `security_opt: no-new-privileges`, and tmpfs mounts for `/tmp`. nginx adds
  back only the capabilities it needs to bind 80/443 and drop to its worker
  user. (Closes `iac-docker-no-user`.)
- **Healthchecks**: backend, frontend, and nginx now have HTTP/socket
  healthchecks. (Closes `iac-docker-no-healthchecks`.)
- **Magic-byte upload validation**: documents.py now validates the first
  bytes of the upload against the declared MIME type (`%PDF-`,
  `\xff\xd8\xff`, PNG signature, TIFF II/MM). Stdlib only — no new dep.
  (Closes `upload-server-validation-001`.)
- **Prompt-injection delimiters**: assessment + letter prompts wrap
  user-supplied content in `--- BEGIN ... ---` / `--- END ... ---` blocks
  with an explicit instruction to treat delimited content as data, not
  instructions. (Closes `llm-prompt-injection-surface-001`.)
- **Dependency hygiene**: `next` bumped from 14.2.16 to ^14.2.35 (closes
  GHSA-f82v-jwr5-mffw critical). 5 newer next-14.x family CVEs remain — they
  only fix in next 16.x and require a major version bump out of scope here;
  documented as a follow-up. Lockfiles generated for both frontend
  (`package-lock.json`) and backend (`requirements.lock`, hash-pinned).
  Dockerfiles switched to lock-driven installs (`npm ci`,
  `pip install --require-hashes`). (Closes `dep-vulnerable-package-001`,
  `dep-no-lockfile-004`.)
- **Misc**: chat error-leak fixed (generic message + server-side log); CSP
  drops `'unsafe-eval'` and adds `object-src 'none'`, `frame-ancestors 'self'`,
  `base-uri 'self'`, `form-action 'self'`; `nginx/certs;C/` artifact deleted;
  Fernet + JWT eagerly validated at startup so misconfig fails fast.
  (Closes `val-error-leak-004`, `iac-nginx-csp-unsafe`,
  `config-startup-key-validation-005`.)

### Lifecycle transition checklist (still pending before public exposure)

The app remains a single-operator prototype today (`lifecycle.stage = prototype`,
`exposure_model = local_only`). Before flipping to `public_production` /
`public_internet` / `user_population = mixed`, the following items remain
open:

- `disclosure.security_contact_email` must be populated.
- `infrastructure.secret_storage` should move from the current Compose
  file-mounted secrets pattern to a managed secret manager
  (AWS Secrets Manager / SOPS / Doppler / 1Password CLI). Right now it's
  declared `dotenv_on_servers` because the schema enum doesn't yet capture
  Compose secrets, but in practice secrets are file-mounted at
  `/run/secrets/*`.
- Move the project off OneDrive-synced storage **OR** exclude `.env` from
  OneDrive's sync settings. Until that's done, secrets at rest are
  cloud-replicated to the user's Microsoft account.
- `infrastructure.audit_logging` is now `sensitive_data_access`. Evaluate
  whether to advance to `comprehensive_immutable` (append-only, tamper-evident
  store) for HIPAA-grade compliance — current AuditLog is plain SQLAlchemy.
- Tighten rate limits from the current `100/minute` baseline to
  `5–20/minute` per route once the cookie migration has soaked.
- `integrations.llm_or_ai_with_user_input.output_rendering` is
  `markdown_sanitized`. Hold this posture: do not enable `rehype-raw`,
  `dangerouslySetInnerHTML`, or any HTML-passthrough plugin in the chat
  render path without revisiting this field.
- The HIPAA posture (`status=in_progress` + `role=n_a`) should be
  reconciled. Either drop HIPAA from the regime list and document the
  voluntary-safeguards posture here, or move to a real role
  (`covered_entity` / `business_associate`) with the corresponding
  legal/contractual relationships in place.
- Consider migrating to next 16.x to close the 5 remaining 14.x family
  CVEs (1 moderate, 4 high — all DoS-class, exploitable internally).

### PHI handling notes

Veteran medical PDFs uploaded by users are parsed locally with
`pymupdf` / `pdfplumber` / `pypdf`, stored on disk under `DOCUMENTS_PATH`
(`./data/documents`), and excerpts are sent to the Anthropic API
(`anthropic` Python SDK) for analysis. Chat content between user and Claude
is similarly stored and processed via Anthropic. SSNs and VA file numbers
may appear inside the uploaded PDFs even though `government_identifiers`
is declared `stored=false` — that field tracks structured storage, not
incidental text inside uploaded documents.

## Notes

*Add other security-relevant context as the project evolves.*
