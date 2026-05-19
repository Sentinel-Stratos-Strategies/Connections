# MJ Dashboard Auth And Mini-Lane Connections

Date: 2026-05-13
Repo: `Sentinel-Stratos-Strategies/Connections`
Branch: `cursor/mj-layer-enterprise-ready-1c9b`
Runtime Worker: `mj-edge`
Dashboard: `https://mcp.ellis-aegis.us/`
MCP endpoint: `https://mcp.ellis-aegis.us/mcp`
Lane registry: `GET https://mcp.ellis-aegis.us/api/console/lanes`

## What I Need From You

For dashboard authentication:

1. The admin usernames to create. Use handles like `joeathan` and `joeellis-dev`; do not use email as the primary login name if the rule is no email login.
2. The required second factor:
   - Recommended v1: password plus authenticator app TOTP.
   - Optional v1.1: SMS OTP.
   - Optional v1.1: email OTP only as a second factor, not as primary login or magic-link login.
3. For SMS OTP, provide the provider choice and credentials through secrets only. Good options are Twilio or another SMS provider already under your account.
4. For email OTP, provide the sender domain and provider credentials through secrets only. Good options are Postmark, SendGrid, Resend, or a Cloudflare Email Workers-compatible route if already approved.
5. The session policy you want, or approve this default:
   - idle timeout: 30 minutes
   - absolute session lifetime: 8 hours
   - remember device: disabled for v1
   - lockout: 5 failed attempts, 15 minute cooldown
6. Recovery policy:
   - 10 single-use recovery codes per admin
   - recovery codes shown once during enrollment
   - recovery-code use writes an audit event
7. Approval to rotate any PAT-shaped value currently used as `OPERATOR_TOKEN`.
8. Approval to create these secrets:
   - `MJ_DASHBOARD_SESSION_SECRET`
   - `MJ_DASHBOARD_AUTH_PEPPER`
   - `MJ_DASHBOARD_ADMIN_BOOTSTRAP`
   - `MJ_DASHBOARD_TOTP_ISSUER`
   - optional `MJ_DASHBOARD_SMS_*`
   - optional `MJ_DASHBOARD_EMAIL_*`

Do not paste passwords, PATs, SMS provider tokens, or email provider tokens into chat. Use GitHub secrets, Cloudflare Worker secrets, local one-time input, or a local `.env` file that is never committed.

## Dashboard Auth Decision

The requirement is:

- Password required.
- Second factor required.
- No Google login.
- No social login.
- No email magic-link login.
- No passkeys or WebAuthn.
- Email is allowed only as a second factor if explicitly enabled.
- SMS is allowed only as a second factor if explicitly enabled.
- Authenticator app TOTP is the v1 default.

Recommended implementation:

- App-native auth inside `mj-edge`, backed by D1.
- Public:
  - `GET /healthz`
  - static asset files after the login HTML shell decision
- Protected by dashboard session:
  - `GET /`
  - `GET /index.html`
  - dashboard API routes
- Protected by operator token and MJ policy headers:
  - `/mcp`
  - `/turn/*`
  - `/audit/*`
  - `/api/*`

Auth tables:

- `dashboard_users`
- `dashboard_password_credentials`
- `dashboard_mfa_factors`
- `dashboard_recovery_codes`
- `dashboard_sessions`
- `dashboard_login_attempts`
- `dashboard_auth_events`

Security controls:

- Password hashes use per-user salt plus global pepper.
- Prefer Argon2id if the Worker bundle proves compatible.
- Fallback to Web Crypto PBKDF2-SHA256 with high iterations and a secret pepper.
- TOTP uses RFC 6238 compatible authenticator apps.
- Session cookie name: `__Host-mj_dashboard_session`.
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`.
- Session IDs are random, hashed at rest, and rotated after login.
- Every login, MFA challenge, lockout, logout, recovery-code use, and failed attempt writes an audit event.

## Auth Implementation Plan

1. Add D1 migration for dashboard auth tables.
2. Add auth modules in `projects/mj-mcp-layer/mcp-layer/src/auth/`.
3. Add route guards before serving dashboard HTML.
4. Add `GET /auth/login`, `POST /auth/login`, `POST /auth/mfa`, `POST /auth/logout`, and `POST /auth/recovery-code`.
5. Add first-admin bootstrap path gated by `MJ_DASHBOARD_ADMIN_BOOTSTRAP`.
6. Add tests proving:
   - `/` redirects to login without a dashboard session.
   - `/healthz` remains public.
   - `/mcp` still rejects missing MJ policy headers.
   - password-only login does not create a session.
   - password plus valid TOTP creates a session.
   - invalid MFA creates an audit event and increments attempts.
   - lockout triggers after the configured failed attempts.
   - recovery code is single-use.
7. Update smoke tests to include dashboard auth redirects and authenticated dashboard access.
8. Deploy with GitHub Actions, then verify the live dashboard path.

## Remote MCP Header Contract

Every protected remote MCP call uses:

```text
Authorization: Bearer <OPERATOR_TOKEN>
x-ellis-aegis-token: <OPERATOR_TOKEN>
x-tenant-id: operator
x-request-id: <generated per request>
x-policy-version: mj-edge-unified-v2
x-operator-capability: mcp.admin
```

Read-only registry discovery can use:

```text
x-operator-capability: forensic.read
```

Do not put GitHub PATs in every Worker. GitHub authority belongs in the GitHub lane only, preferably through GitHub App credentials, OIDC, or the runtime's existing GitHub connector. Worker runtime auth should use a dedicated MJ operator token, not a GitHub PAT.

## Connection Modes

| Mode | How It Connects | Secret Rule |
|---|---|---|
| `remote_mcp_operator` | Configure the client to call the MJ MCP endpoint with the required headers. | Use dedicated `OPERATOR_TOKEN`, not a provider PAT. |
| `local_console_connector` | Use the local Codex/plugin connector and record activity through MJ. | Local tool authority stays local unless a protected MCP call is made. |
| `optional_local_plugin` | Install the plugin only when profile-backed browser or desktop control is required. | Do not enable by default for unattended operations. |
| `github_app_or_oidc` | Use GitHub App/OIDC or the GitHub connector for repo and workflow actions. | Do not copy PATs into all Workers. |
| `cloudflare_api_token` | Use scoped Cloudflare API token plus account and zone IDs. | Store in GitHub/Cloudflare secrets only. |
| `api_or_connector` | Use an approved connector first, API token second. | Scope token to the lane's exact job. |
| `oauth_connector` | Use the installed app connector and provider OAuth scopes. | Do not export OAuth tokens into source or manifests. |
| `local_build_connector` | Use local build tools such as Xcode or local package tooling. | Signing secrets require explicit approval. |
| `local_artifact_connector` | Generate local docs, decks, sheets, or evidence artifacts. | Keep artifacts scrubbed of secrets. |
| `local_bridge` | Run a local-only bridge on `127.0.0.1`. | Never expose publicly. |

## Mini-Lane Connection Matrix

| Lane | Console | Status | Mode | Endpoint | Required secret or connector | Capabilities | Connect path |
|---|---|---|---|---|---|---|---|
| `mj-codex` | Codex | `ready_for_operator_token` | `remote_mcp_operator` | `https://codex.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `script.run`, `cloud.ops`, `forensic.read` | Connect Codex to remote MCP with the MJ operator headers. |
| `mj-browser` | Browser | `ready_for_connector_scope` | `local_console_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `forensic.read` | Use the in-app Browser lane for deployed dashboard validation. |
| `mj-chrome` | chrome | `connector_install_required` | `optional_local_plugin` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `forensic.read` | Install Chrome automation only for approved profile-backed browser work. |
| `mj-computer` | Computer | `connector_install_required` | `optional_local_plugin` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `forensic.read` | Install computer-use only for explicit desktop operations. |
| `mj-superpowers` | Superpowers | `ready_for_connector_scope` | `local_console_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `forensic.read` | Use as the method lane for planning, TDD, verification, and handoff discipline. |
| `mj-github` | GitHub | `ready_for_app_or_oidc` | `github_app_or_oidc` | `https://mcp.ellis-aegis.us/mcp` | GitHub App, OIDC, or approved GitHub connector | `repo.read`, `pr.comment`, `workflow.dispatch` | Keep GitHub Actions as the deploy gate; do not use global Worker PATs. |
| `mj-cloudflare` | Cloudflare | `ready_for_api_token` | `cloudflare_api_token` | `https://mcp.ellis-aegis.us/mcp` | `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID_ELLIS`, `CF_ZONE_ID_HITCH`, `CF_ZONE_ID_KEVIS` | `cloud.ops`, `security.status`, `forensic.read` | Use Cloudflare for Workers, D1, R2, KV, queues, zones, WAF, and smoke checks. |
| `mj-openai` | OpenAI Developers | `ready_for_connector_scope` | `api_or_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPENAI_API_KEY` or approved OpenAI connector | `model.route`, `tool.call_approved` | Use official OpenAI APIs/connectors; never expose key values through MJ. |
| `mj-figma` | Figma | `ready_for_connector_scope` | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Figma connector | `doc.read`, `tool.call_approved` | Use for design-system and implementation handoffs. |
| `mj-google` | Google | `ready_for_oauth_or_service_account` | `oauth_or_service_account` | `https://mcp.ellis-aegis.us/mcp` | `GOOGLE_SERVICE_ACCOUNT_JSON` or approved OAuth connector | `drive.read_approved`, `workspace.action_approved` | Use for Workspace, Firebase, AI Studio, Gemini, and Vertex operations. |
| `mj-google-drive` | Google Drive | `ready_for_connector_scope` | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Google Drive connector | `doc.read`, `doc.update_approved` | Use Drive, Docs, Sheets, and Slides for projections and operating artifacts. |
| `mj-google-calendar` | Google Calendar | `ready_for_connector_scope` | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Google Calendar connector | `doc.read`, `tool.call_approved` | Use for scheduling, prep, and availability projections. |
| `mj-notion` | Notion | `ready_for_connector_scope` | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `NOTION_TOKEN` or approved Notion connector | `doc.read`, `doc.update_approved` | Use for specs, knowledge capture, and implementation planning projections. |
| `mj-linear` | Linear | `ready_for_connector_scope` | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `LINEAR_API_KEY` or approved Linear connector | `issue.read`, `issue.update_approved` | Use for issue, project, and build-task projections. |
| `mj-gmail` | Gmail | `ready_for_connector_scope` | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Gmail connector | `doc.read`, `tool.call_approved` | Use for support triage and reply drafts; sends require approval. |
| `mj-circleci` | CircleCI | `ready_for_api_token` | `api_or_connector` | `https://mcp.ellis-aegis.us/mcp` | `CIRCLECI_TOKEN` or approved CircleCI connector | `forensic.read`, `tool.call_approved` | Use as auxiliary CI; GitHub Actions remains MJ v1 deploy authority. |
| `mj-build-ios` | Build iOS Apps | `ready_for_connector_scope` | `local_build_connector` | `https://mcp.ellis-aegis.us/mcp` | local Xcode signing access when explicitly approved | `script.run`, `forensic.read` | Use for simulator, build, and test workflows. |
| `mj-build-macos` | Build macOS Apps | `ready_for_connector_scope` | `local_build_connector` | `https://mcp.ellis-aegis.us/mcp` | local signing or notarization access when explicitly approved | `script.run`, `forensic.read` | Use for local macOS build, test, and package workflows. |
| `mj-build-web` | Build Web Apps | `ready_for_connector_scope` | `local_frontend_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` for deployed dashboard smokes | `mcp.admin`, `forensic.read` | Use for MJ dashboard implementation, browser QA, and deployment evidence. |
| `mj-network-solutions` | Network Solutions | `ready_for_connector_scope` | `domain_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Network Solutions connector | `forensic.read`, `tool.call_approved` | Use for domain search and registrar handoff; Cloudflare remains DNS/runtime authority. |
| `mj-codex-security` | Codex Security | `ready_for_connector_scope` | `security_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Codex Security connector | `security.status`, `forensic.read` | Use for security scan, validation, threat model, and finding fix review. |
| `mj-scite` | Scite | `ready_for_connector_scope` | `research_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Scite connector | `doc.read`, `forensic.read` | Use for research-backed enterprise, security, and compliance claims. |
| `mj-canva` | Canva | `ready_for_connector_scope` | `design_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Canva connector | `doc.read`, `tool.call_approved` | Use for branded design and presentation artifacts. |
| `mj-supabase` | Supabase | `ready_for_connector_scope` | `database_connector` | `https://mcp.ellis-aegis.us/mcp` | approved Supabase connector | `cloud.ops`, `forensic.read` | Use for future product database operations, not MJ v1 runtime truth. |
| `mj-documents` | Documents | `ready_for_local_artifact_scope` | `local_artifact_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `doc.read`, `tool.call_approved` | Use for local docx artifacts, render checks, and handoff documents. |
| `mj-presentations` | Presentations | `ready_for_local_artifact_scope` | `local_artifact_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `doc.read`, `tool.call_approved` | Use for deck generation, render verification, and enterprise narratives. |
| `mj-spreadsheets` | Spreadsheets | `ready_for_local_artifact_scope` | `local_artifact_connector` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `doc.read`, `forensic.read` | Use for evidence tables, billing models, and operational reports. |
| `mj-test-android` | Test Android Apps | `ready_for_connector_scope` | `local_emulator_connector` | `https://mcp.ellis-aegis.us/mcp` | local Android emulator access | `script.run`, `forensic.read` | Use for Android emulator QA and performance evidence. |
| `mj-vercel` | Vercel | `ready_for_connector_scope` | `api_or_connector` | `https://mcp.ellis-aegis.us/mcp` | `VERCEL_TOKEN` or approved Vercel connector | `cloud.ops`, `forensic.read` | Use for preview frontend deployments and status projections. |
| `mj-railway` | Railway | `ready_for_api_token` | `api_token` | `https://mcp.ellis-aegis.us/mcp` | `RAILWAY_TOKEN` | `cloud.ops`, `forensic.read` | Use for backend service and preview deployment projections. |
| `mj-gadget` | Gadget | `ready_for_api_token` | `api_token` | `https://mcp.ellis-aegis.us/mcp` | `GADGET_API_KEY` | `mcp.admin`, `cloud.ops` | Use for approved Gadget app and backend builder workflows. |
| `mj-zed` | Zed | `ready_for_operator_token` | `remote_mcp_operator` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `script.run`, `forensic.read` | Connect Zed as an approved remote MCP operator. |
| `mj-cursor` | Cursor | `ready_for_operator_token` | `remote_mcp_operator` | `https://mcp.ellis-aegis.us/mcp` | `OPERATOR_TOKEN` | `mcp.admin`, `script.run`, `forensic.read` | Connect Cursor as an approved remote MCP operator. |
| `mj-local-models` | Local Models | `ready_for_local_bridge` | `local_bridge` | `http://127.0.0.1:8789/mcp` | local Ollama models | `script.run`, `forensic.read` | Start only for local inference lanes; never expose publicly. |

## Activation Order

1. Rotate the PAT-shaped `OPERATOR_TOKEN` away from any GitHub PAT.
2. Add dashboard auth v1 with password plus TOTP.
3. Gate dashboard routes behind session auth.
4. Keep remote MCP endpoints on MJ operator-token policy.
5. Connect only the lanes needed for active work.
6. Add SMS or email second factor after TOTP is proven, only if you approve the provider and secrets.
7. Keep GitHub Actions as the deploy gate and leave Cloudflare native Workers Builds as secondary until its token ownership problem is repaired.

