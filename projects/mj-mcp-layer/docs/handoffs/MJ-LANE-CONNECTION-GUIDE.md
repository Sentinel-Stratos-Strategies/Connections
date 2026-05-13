# MJ Lane Connection Guide

**Platform:** Ellis Aegis / MJ MCP Control Plane  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Health Check:** `https://mcp.ellis-aegis.us/healthz`  
**Version:** mj-edge-unified-v2  
**Last Updated:** 2026-05

---

## Overview

MJ is a multi-tenant MCP (Model Context Protocol) control plane running on Cloudflare Workers. It exposes a governed, auditable, deny-by-default API surface that allows approved tools, editors, agents, and platforms to call tools, execute turns, and read audit events through a single hardened endpoint.

Each external tool or platform connects through its own **mini-lane** — a scoped identity with isolated permissions, allowed capabilities, and audit requirements.

---

## Authentication

Every request (except `/healthz`) requires all four policy headers plus a bearer token.

### Required Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <OPERATOR_TOKEN>` |
| `x-ellis-aegis-token` | `<OPERATOR_TOKEN>` (same value) |
| `x-tenant-id` | Your assigned tenant ID |
| `x-request-id` | Unique UUID per request |
| `x-policy-version` | `mj-edge-unified-v2` |
| `x-operator-capability` | Your granted capability |

### Capabilities

| Capability | What it unlocks |
|------------|-----------------|
| `mcp.admin` | Full MCP tools, turns, change requests, ledger, audit |
| `forensic.read` | Read-only audit events, ledger, assets, incidents |
| `cloud.ops` | Run checks, submit change requests |
| `security.status` | Security posture reads and check dispatch |
| `script.run` | Execute approved automation turns |

---

## Endpoints

| Path | Methods | Purpose |
|------|---------|---------|
| `GET /healthz` | Public | System health, no auth required |
| `GET /mcp` | mcp.admin, forensic.read | MCP capability manifest |
| `POST /mcp` | mcp.admin | Execute MCP tool calls (JSON-RPC 2.0) |
| `POST /turn/:id` | script.run, mcp.admin | Execute a multi-step turn |
| `GET /audit/events` | forensic.read, mcp.admin | Query immutable audit log |
| `GET /api/ledger` | forensic.read, mcp.admin | Query SHA-256 signed ledger |
| `POST /api/change-request` | cloud.ops, mcp.admin | Submit a change request |
| `GET /api/change-request` | forensic.read, mcp.admin | List change requests |
| `GET /api/assets` | forensic.read, mcp.admin | List tracked assets |
| `GET /api/events` | forensic.read, mcp.admin | List events |
| `GET /api/incidents` | forensic.read, mcp.admin | List incidents |
| `POST /api/checks/run` | cloud.ops, security.status, mcp.admin | Dispatch a watcher check |

---

## MCP Protocol (JSON-RPC 2.0)

The `/mcp` `POST` endpoint follows the MCP specification.

### Tool List Request
```/dev/null/example.json#L1-8
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Tool Call Request
```/dev/null/example.json#L1-12
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "health_check",
    "arguments": {}
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `health_check` | Returns system health and storage status |
| `drift_scan` | Dispatches a drift detection watcher job |
| `audit_query` | Queries the audit event log |
| `change_request` | Submits a change request for operator approval |

---

## Quick-Start curl Examples

```/dev/null/examples.sh#L1-30
# Health check (no auth required)
curl https://mcp.ellis-aegis.us/healthz

# MCP capability manifest
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "x-ellis-aegis-token: YOUR_TOKEN" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: mcp.admin" \
     https://mcp.ellis-aegis.us/mcp

# MCP tool call
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "x-ellis-aegis-token: YOUR_TOKEN" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: mcp.admin" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
     https://mcp.ellis-aegis.us/mcp

# Audit events (last 50)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "x-ellis-aegis-token: YOUR_TOKEN" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: forensic.read" \
     "https://mcp.ellis-aegis.us/audit/events?limit=50"
```

---

## Lane-by-Lane Connection Guides

Each third-party lane has its own handoff document in this directory:

| Lane | File | Platform |
|------|------|---------|
| mj-zed | [zed-lane.md](./zed-lane.md) | Zed Editor |
| mj-codex | [codex-lane.md](./codex-lane.md) | OpenAI Codex |
| mj-cursor | [cursor-lane.md](./cursor-lane.md) | Cursor IDE |
| mj-github | [github-lane.md](./github-lane.md) | GitHub / Actions |
| mj-notion | [notion-lane.md](./notion-lane.md) | Notion |
| mj-linear | [linear-lane.md](./linear-lane.md) | Linear |
| mj-openai | [openai-lane.md](./openai-lane.md) | OpenAI Platform |
| mj-vercel | [vercel-lane.md](./vercel-lane.md) | Vercel |
| mj-cloudflare | [cloudflare-lane.md](./cloudflare-lane.md) | Cloudflare |
| mj-google | [google-lane.md](./google-lane.md) | Google Workspace / Cloud |
| mj-railway | [railway-lane.md](./railway-lane.md) | Railway |
| mj-gadget | [gadget-lane.md](./gadget-lane.md) | Gadget |

---

## Security Model

- **Deny by default** — any request missing required headers returns `403`
- **Timing-safe token comparison** — bearer tokens compared with constant-time equality
- **Immutable audit trail** — every protected request writes a signed audit event to D1
- **Capability scoping** — each capability unlocks only the endpoints and methods listed above
- **No payload logging** — request bodies are never logged
- **CORS hardened** — only `mj.ellis-aegis.us`, `mcp.ellis-aegis.us`, and `codex.ellis-aegis.us` are allowed origins
- **Rate limits** — 120 req/min on `/mcp`, 60 req/min on `/turn/*` (managed challenge + block)
- **Bot exemption** — `/mcp` and `/turn/*` are whitelisted from bot fight mode since clients are agents by design

---

## What to Hand Off to Your Lane

When connecting your app or tool as a new lane, provide the operator with:

1. **Desired tenant ID** — unique identifier for your lane (e.g. `notion-prod`)
2. **Required capabilities** — the minimum capability set your tool needs
3. **Allowed actions** — what operations your tool will perform (used to write the `lane.manifest.json`)
4. **Auth mode** — how your tool authenticates (api_key, oauth, mcp_connector, github_oidc)
5. **Your platform's MCP config block** — if your platform supports MCP natively (like Zed or Cursor), provide the JSON/TOML config block
6. **Webhook or notification endpoint** — if you need audit or alert callbacks

The operator will:
- Issue you an `OPERATOR_TOKEN` scoped to your capability set
- Register your lane in `infrastructure-connections.json`
- Add a `lane.manifest.json` for your platform
- Confirm your tenant entry in the policy engine

---

## Error Codes

| HTTP | Body | Meaning |
|------|------|---------|
| 403 | `{"error":"deny_by_default","policy":"..."}` | Missing or invalid headers |
| 403 | `{"error":"missing_headers","missing_headers":[...]}` | One or more required headers absent |
| 405 | `{"error":"method_not_allowed"}` | Wrong HTTP method for this path |
| 403 | `{"error":"capability_denied"}` | Token lacks required capability |
| 401 | `{"error":"unauthorized"}` | Token invalid or not provided |
| 404 | (HTML home page) | Path not in allowed_paths |
