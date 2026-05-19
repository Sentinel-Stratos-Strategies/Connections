# Antigravity Lane — MJ MCP Connection Handoff

**Lane:** `mj-antigravity`  
**Platform:** Antigravity App (`/Applications/Antigravity.app`)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin`, `script.run`, `forensic.read`  
**Auth Mode:** Bearer token via MCP operator config  

---

## What Antigravity Gets

Antigravity connects to the MJ control plane as an approved MCP operator. As an AI/dev control surface, it can:

- List and call approved MCP tools (health check, drift scan, audit query, change request)
- Read system status and audit events
- Propose and plan code changes with MJ context
- Execute turns through the multi-step turn endpoint
- Receive audit projections without accessing canonical truth

---

## Antigravity-Side Setup

### 1. Configure MCP Connection

In Antigravity's connection settings or configuration:

| Setting | Value |
|---------|-------|
| **Server URL** | `https://mcp.ellis-aegis.us/mcp` |
| **Auth Type** | `Bearer` / `Header` |
| **Auth Header** | `x-ellis-aegis-token` |
| **Token** | `YOUR_OPERATOR_TOKEN` |
| **Tenant ID** | `kevis` (or your assigned tenant) |
| **Policy Version** | `mj-edge-unified-v2` |
| **Capability** | `mcp.admin` |

Replace `YOUR_OPERATOR_TOKEN` with the token issued to the `mj-antigravity` lane.

### 2. Required Headers

Ensure the following headers are included in every MCP request:

- `Authorization: Bearer YOUR_OPERATOR_TOKEN`
- `x-ellis-aegis-token: YOUR_OPERATOR_TOKEN`
- `x-tenant-id: kevis`
- `x-request-id: <unique-uuid>`
- `x-policy-version: mj-edge-unified-v2`
- `x-operator-capability: mcp.admin`

---

## What the Operator Hands Off to Antigravity

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per-tenant (never shared) |
| Tenant ID | `kevis` (or your assigned tenant) |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` |

---

## Verification

After configuring Antigravity, verify the connection:

```bash
# From terminal — confirm health
curl https://mcp.ellis-aegis.us/healthz

# Confirm MCP responds with your token
export MJ_OPERATOR_TOKEN="set-in-shell"
curl -H "x-ellis-aegis-token: ${MJ_OPERATOR_TOKEN:?set MJ_OPERATOR_TOKEN}" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: test-antigravity-001" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: mcp.admin" \
     https://mcp.ellis-aegis.us/mcp
```

Expected response includes `"protocol": "mcp"` and the tools list.

---

## Lane Boundaries

Antigravity via `mj-antigravity` is allowed to:
- Read code context and plan changes
- Call approved MCP tools
- Execute `script.run` turns
- Read audit events with `forensic.read`

Antigravity is **not** allowed to:
- Write canonical truth memory
- Read secret values
- Deploy to production without approval
- Call unapproved external endpoints
- Bypass MJ Core routing

---

## Audit

Every tool call Antigravity makes through this lane is recorded in the immutable audit log at `/audit/events`. The actor will be tagged as `antigravity-operator` with the tenant ID and request ID included in every event.
