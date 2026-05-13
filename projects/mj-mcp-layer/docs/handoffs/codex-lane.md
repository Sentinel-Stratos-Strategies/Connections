# Codex Lane — MJ MCP Connection Handoff

**Lane:** `mj-codex`  
**Platform:** OpenAI Codex (GUI, CLI, Web)  
**MCP Endpoint:** `https://codex.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin`, `script.run`, `forensic.read`, `cloud.ops`  
**Auth Mode:** Bearer token via MCP connector  

---

## What Codex Gets

Codex is the primary human operator interface for the MJ system. It has the broadest capability set of any lane and connects through the dedicated `codex.ellis-aegis.us` subdomain.

Codex can:
- Call all approved MCP tools
- Execute multi-step turns
- Submit and review change requests
- Read the full audit trail and ledger
- Dispatch drift and security checks
- Orchestrate cross-lane workflows (Notion → Linear → GitHub → Vercel)

---

## Codex CLI Setup

### 1. Set Environment Variables

```/dev/null/codex-env.sh#L1-15
# Add to your shell profile or pass per-session
export MCP_SERVER_URL="https://codex.ellis-aegis.us/mcp"
export MJ_OPERATOR_TOKEN="YOUR_OPERATOR_TOKEN"
export MJ_TENANT_ID="kevis"
export MJ_POLICY_VERSION="mj-edge-unified-v2"
export MJ_CAPABILITY="mcp.admin"

# Codex CLI MCP config (if supported natively)
export CODEX_MCP_URL="$MCP_SERVER_URL"
export CODEX_MCP_TOKEN="$MJ_OPERATOR_TOKEN"
```

### 2. Codex MCP Config File (`~/.codex/mcp.json` or equivalent)

```/dev/null/codex-mcp.json#L1-20
{
  "servers": {
    "mj-ellis-aegis": {
      "url": "https://codex.ellis-aegis.us/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OPERATOR_TOKEN",
        "x-ellis-aegis-token": "YOUR_OPERATOR_TOKEN",
        "x-tenant-id": "kevis",
        "x-request-id": "auto",
        "x-policy-version": "mj-edge-unified-v2",
        "x-operator-capability": "mcp.admin"
      }
    }
  }
}
```

### 3. Codex GUI (Desktop App)

In Codex GUI → Settings → MCP Connectors, add a new connector:

| Field | Value |
|-------|-------|
| Name | `MJ Control Plane` |
| URL | `https://codex.ellis-aegis.us/mcp` |
| Auth type | Bearer |
| Token | `YOUR_OPERATOR_TOKEN` |
| Extra header 1 | `x-ellis-aegis-token: YOUR_OPERATOR_TOKEN` |
| Extra header 2 | `x-tenant-id: kevis` |
| Extra header 3 | `x-policy-version: mj-edge-unified-v2` |
| Extra header 4 | `x-operator-capability: mcp.admin` |

---

## What the Operator Hands Off to Codex

| Item | Value |
|------|-------|
| Primary MCP URL | `https://codex.ellis-aegis.us/mcp` |
| Secondary URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | `YOUR_OPERATOR_TOKEN` (issued per session) |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Full capability | `mcp.admin` |
| Operator header | `x-ellis-aegis-token` |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `local_kit.validate` | Validate a local widget/check kit |
| `bridge.command.prepare` | Prepare a bridge command for operator review |
| `code.plan` | Generate an implementation plan |
| `code.patch_propose` | Propose a code patch |
| `mcp.connector.list` | List available MCP connectors |
| `mcp.connector.call_approved` | Call an approved connector |

### Approval Required

- `code.patch_apply` — applying a patch to a file
- `mcp.connector.add_external` — adding a new external connector
- `bridge.push_production` — pushing to a production endpoint

---

## Verification (from Codex CLI)

```/dev/null/verify.sh#L1-8
# Health check
curl https://codex.ellis-aegis.us/healthz

# Capability manifest (copy headers from above)
export MJ_OPERATOR_TOKEN="set-in-shell"
curl -H "x-ellis-aegis-token: ${MJ_OPERATOR_TOKEN:?set MJ_OPERATOR_TOKEN}" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: $(uuidgen)" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: mcp.admin" \
     https://codex.ellis-aegis.us/mcp
```

---

## Sacred Boundary

Even as the primary operator lane, Codex cannot:
- Write canonical truth memory
- Read or expose secret values
- Bypass MJ Core routing to call platform APIs directly
- Recover deleted login history from any platform
