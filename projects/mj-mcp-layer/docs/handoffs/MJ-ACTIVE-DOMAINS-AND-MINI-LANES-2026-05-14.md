# MJ Active Domains And Mini Lanes

Verified: 2026-05-14, America/Chicago

## Main Answer

Use this for the main MJ Layer Edge tunnel:

```text
Dashboard:    https://mcp.ellis-aegis.us/
MCP endpoint: https://mcp.ellis-aegis.us/mcp
Health:       https://mcp.ellis-aegis.us/healthz
Policy:       mj-edge-unified-v2
Worker:       mj-edge
```

`mcp.ellis-aegis.us` is the main phone/tool endpoint because it is active, resolves publicly, serves the dashboard, returns `200` on `/healthz`, and returns the expected protected-route denial on `/mcp` when policy headers are missing.

`mj.ellis-aegis.us` is also active and points at the same MJ Edge surface, but treat it as the operator/control-plane brand host. Use `mcp.ellis-aegis.us/mcp` for phones, MCP clients, editor integrations, and mini-lane connections.

## Active Cloudflare Zones

| Zone | Cloudflare state | Notes |
| --- | --- | --- |
| `ellis-aegis.us` | active | Main authority zone for MJ Layer, MCP, dashboard, Codex/control-plane, and API routes. |
| `hitch.guru` | active | Zone exists, but no public A/CNAME host route was active during verification. |
| `kevis.online` | active | Zone exists and has a desired `kevis.online/api/*` Worker route, but public DNS for apex/www was not resolving during verification. |

## Public Host Status

| Host | Live status | Worker / origin observed | Use it for |
| --- | --- | --- | --- |
| `mcp.ellis-aegis.us` | active: `/` `200`, `/healthz` `200`, `/mcp` protected `403` without headers | `mj-edge` | Primary phone/tool/MCP endpoint. |
| `mj.ellis-aegis.us` | active: `/` `200`, `/healthz` `200`, `/mcp` protected `403` without headers | `mj-edge` | Operator dashboard/control-plane alias. |
| `codex.ellis-aegis.us` | active: `/` `200`, `/healthz` `200`, `/mcp` protected `401` without token | `ellis-aegis-control-plane` | Codex/control-plane lane, not the main phone endpoint. |
| `api.ellis-aegis.us` | active: `/` `200`, `/healthz` `200`, `/mcp` protected `401` without token | `ellis-aegis-control-plane` | API/control-plane host. |
| `dashboard.ellis-aegis.us` | active: `/` `200`, `/healthz` `200`, `/mcp` protected `401` without token | `ellis-aegis-control-plane` | Legacy/control-plane dashboard host. |
| `hitch.ellis-aegis.us` | active: `/healthz` `200`, `/mcp` `200` with Hitch MCP descriptor | `hitch.gadget.app` CNAME | Hitch-specific lane. Do not use for main MJ Layer phones. |
| `ellis-aegis.us` | not resolving publicly | none observed | Apex is not the MJ endpoint right now. |
| `cursor.ellis-aegis.us` | not resolving publicly | none observed | Declared future/cutover lane only. |
| `gemini.ellis-aegis.us` | not resolving publicly | none observed | Declared future/cutover lane only. |
| `chatgpt.ellis-aegis.us` | not resolving publicly | none observed | Declared future/cutover lane only. |
| `antigravity.ellis-aegis.us` | not resolving publicly | none observed | Declared future/cutover lane only. |
| `antigrativy.ellis-aegis.us` | not resolving publicly | none observed | Typo/redirect candidate only. |
| `kevis.ellis-aegis.us` | not resolving publicly | none observed | Declared future/cutover lane only. |
| `hitch.guru` | not resolving publicly | zone active, no public host route observed | Project domain not ready for MJ protected routing. |
| `kevis.online` | not resolving publicly | zone active, `kevis.online/api/*` route desired/installed, DNS absent | Project domain not ready for phone/MJ routing. |
| `www.kevis.online` | not resolving publicly | none observed | Project domain not ready. |

## Cloudflare Route State Observed

| Zone | Route | Worker |
| --- | --- | --- |
| `ellis-aegis.us` | `mcp.ellis-aegis.us/*` | `mj-edge` |
| `ellis-aegis.us` | `mj.ellis-aegis.us/*` | `mj-edge` |
| `ellis-aegis.us` | `codex.ellis-aegis.us/*` | `ellis-aegis-control-plane` |
| `ellis-aegis.us` | `api.ellis-aegis.us/*` | `ellis-aegis-control-plane` |
| `ellis-aegis.us` | `dashboard.ellis-aegis.us/*` | `ellis-aegis-control-plane` |
| `kevis.online` | `kevis.online/api/*` | `kevis-mj-edge` |
| `hitch.guru` | none observed | none observed |

## Phone Setup

Use these values anywhere the phone app, shortcut, mobile browser workflow, or MCP-capable mobile tool asks for a server.

| Setting | Value |
| --- | --- |
| Display name | `MJ Layer Edge` |
| Server URL | `https://mcp.ellis-aegis.us/mcp` |
| Dashboard URL | `https://mcp.ellis-aegis.us/` |
| Health URL | `https://mcp.ellis-aegis.us/healthz` |
| Auth header | `x-ellis-aegis-token` |
| Token value | use the operator token from the secure password manager or environment, never paste it into docs |
| Tenant header | `x-tenant-id` |
| Default tenant | `operator` for owner operations, or a scoped tenant such as `kevis` / `hitch` |
| Request header | `x-request-id` with a fresh UUID per call |
| Policy header | `x-policy-version: mj-edge-unified-v2` |
| Capability header | `x-operator-capability` |

Suggested phone capability:

```text
x-operator-capability: mcp.admin
```

Use `forensic.read` instead when the phone only needs status, audit, or read-only checks.

## Mini Lane Rules

All mini lanes are projections into the main MJ MCP control plane. Most lanes connect through:

```text
https://mcp.ellis-aegis.us/mcp
```

Exception:

```text
mj-local-models -> http://127.0.0.1:8789/mcp
```

That local-models lane is intentionally local-only and should not be exposed publicly.

## Mini Lane Registry

Live registry count verified from `/api/console/lanes`: `34`.

| Lane | Connector | Mode | Endpoint | Capabilities | Current status |
| --- | --- | --- | --- | --- | --- |
| `mj-codex` | Codex | `remote_mcp_operator` | `https://codex.ellis-aegis.us/mcp` | `mcp.admin`, `script.run`, `cloud.ops`, `forensic.read` | `ready_for_operator_token` |
| `mj-browser` | Browser | `local_console_connector` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `forensic.read` | `ready_for_connector_scope` |
| `mj-chrome` | chrome | `optional_local_plugin` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `forensic.read` | `connector_install_required` |
| `mj-computer` | Computer | `optional_local_plugin` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `forensic.read` | `connector_install_required` |
| `mj-superpowers` | Superpowers | `local_console_connector` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `forensic.read` | `ready_for_connector_scope` |
| `mj-github` | GitHub | `github_app_or_oidc` | `https://mcp.ellis-aegis.us/mcp` | `repo.read`, `pr.comment`, `workflow.dispatch` | `ready_for_app_or_oidc` |
| `mj-cloudflare` | Cloudflare | `cloudflare_api_token` | `https://mcp.ellis-aegis.us/mcp` | `cloud.ops`, `security.status`, `forensic.read` | `ready_for_api_token` |
| `mj-openai` | OpenAI Developers | `api_or_connector` | `https://mcp.ellis-aegis.us/mcp` | `model.route`, `tool.call_approved` | `ready_for_connector_scope` |
| `mj-figma` | Figma | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `tool.call_approved` | `ready_for_connector_scope` |
| `mj-google` | Google | `oauth_or_service_account` | `https://mcp.ellis-aegis.us/mcp` | `drive.read_approved`, `workspace.action_approved` | `ready_for_oauth_or_service_account` |
| `mj-google-drive` | Google Drive | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `doc.update_approved` | `ready_for_connector_scope` |
| `mj-google-calendar` | Google Calendar | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `tool.call_approved` | `ready_for_connector_scope` |
| `mj-notion` | Notion | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `doc.update_approved` | `ready_for_connector_scope` |
| `mj-linear` | Linear | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `issue.read`, `issue.update_approved` | `ready_for_connector_scope` |
| `mj-gmail` | Gmail | `oauth_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `tool.call_approved` | `ready_for_connector_scope` |
| `mj-circleci` | CircleCI | `api_or_connector` | `https://mcp.ellis-aegis.us/mcp` | `forensic.read`, `tool.call_approved` | `ready_for_api_token` |
| `mj-build-ios` | Build iOS Apps | `local_build_connector` | `https://mcp.ellis-aegis.us/mcp` | `script.run`, `forensic.read` | `ready_for_connector_scope` |
| `mj-build-macos` | Build macOS Apps | `local_build_connector` | `https://mcp.ellis-aegis.us/mcp` | `script.run`, `forensic.read` | `ready_for_connector_scope` |
| `mj-build-web` | Build Web Apps | `local_frontend_connector` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `forensic.read` | `ready_for_connector_scope` |
| `mj-network-solutions` | Network Solutions | `domain_connector` | `https://mcp.ellis-aegis.us/mcp` | `forensic.read`, `tool.call_approved` | `ready_for_connector_scope` |
| `mj-codex-security` | Codex Security | `security_connector` | `https://mcp.ellis-aegis.us/mcp` | `security.status`, `forensic.read` | `ready_for_connector_scope` |
| `mj-scite` | Scite | `research_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `forensic.read` | `ready_for_connector_scope` |
| `mj-canva` | Canva | `design_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `tool.call_approved` | `ready_for_connector_scope` |
| `mj-supabase` | Supabase | `database_connector` | `https://mcp.ellis-aegis.us/mcp` | `cloud.ops`, `forensic.read` | `ready_for_connector_scope` |
| `mj-documents` | Documents | `local_artifact_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `tool.call_approved` | `ready_for_local_artifact_scope` |
| `mj-presentations` | Presentations | `local_artifact_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `tool.call_approved` | `ready_for_local_artifact_scope` |
| `mj-spreadsheets` | Spreadsheets | `local_artifact_connector` | `https://mcp.ellis-aegis.us/mcp` | `doc.read`, `forensic.read` | `ready_for_local_artifact_scope` |
| `mj-test-android` | Test Android Apps | `local_emulator_connector` | `https://mcp.ellis-aegis.us/mcp` | `script.run`, `forensic.read` | `ready_for_connector_scope` |
| `mj-vercel` | Vercel | `api_or_connector` | `https://mcp.ellis-aegis.us/mcp` | `cloud.ops`, `forensic.read` | `ready_for_connector_scope` |
| `mj-railway` | Railway | `api_token` | `https://mcp.ellis-aegis.us/mcp` | `cloud.ops`, `forensic.read` | `ready_for_api_token` |
| `mj-gadget` | Gadget | `api_token` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `cloud.ops` | `ready_for_api_token` |
| `mj-zed` | Zed | `remote_mcp_operator` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `script.run`, `forensic.read` | `ready_for_operator_token` |
| `mj-cursor` | Cursor | `remote_mcp_operator` | `https://mcp.ellis-aegis.us/mcp` | `mcp.admin`, `script.run`, `forensic.read` | `ready_for_operator_token` |
| `mj-local-models` | Local Models | `local_bridge` | `http://127.0.0.1:8789/mcp` | `script.run`, `forensic.read` | `ready_for_local_bridge` |

## Workflow Incorporation Checklist

1. Choose the mini lane that matches the tool.
2. Use the endpoint in the table.
3. Add the required policy headers.
4. Store token/API secrets only in the tool's secure settings, GitHub Actions secrets, Cloudflare Worker secrets, or local password manager.
5. Use the smallest capability that works:
   - `forensic.read` for status/audit/read-only use.
   - `script.run` for approved automation turns.
   - `cloud.ops` for infrastructure change requests.
   - `mcp.admin` only for operator/admin flows.
6. Run a health check before wiring deeper automation:

```sh
curl https://mcp.ellis-aegis.us/healthz
```

7. For protected calls, include:

```sh
curl -H "x-ellis-aegis-token: ${MJ_OPERATOR_TOKEN:?set MJ_OPERATOR_TOKEN}" \
     -H "x-tenant-id: operator" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: forensic.read" \
     https://mcp.ellis-aegis.us/mcp
```

## Current Cutover Notes

- Keep `mcp.ellis-aegis.us` as the phone/tool tunnel.
- Keep `mj.ellis-aegis.us` as the operator dashboard alias.
- Do not use `codex.ellis-aegis.us` as the general phone tunnel; it is active but mapped to the older control-plane Worker.
- Do not wire phones to `hitch.guru`, `kevis.online`, or their future protected `/mcp` routes yet; those public project domains were not live-resolving during verification.
- `hitch.ellis-aegis.us` is active but project-specific and should stay separate from the master MJ tunnel.
