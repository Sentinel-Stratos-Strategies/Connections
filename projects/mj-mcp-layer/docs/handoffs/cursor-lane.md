# Cursor Lane — MJ MCP Connection Handoff

**Lane:** `mj-cursor`  
**Platform:** Cursor IDE (https://cursor.com)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin`, `script.run`, `forensic.read`  
**Auth Mode:** Bearer token via Cursor MCP config  

---

## What Cursor Gets

Cursor connects to the MJ control plane as an approved development IDE operator. Through its AI and MCP integration, Cursor can:

- Access approved MCP tools for health checks, drift scans, audit reads, and change requests
- Plan and propose code changes with MJ orchestration context
- Read audit events for debugging and compliance
- Execute approved turns through the MJ turn endpoint

---

## Cursor MCP Setup

Cursor supports MCP servers natively. Add the MJ server to your Cursor MCP configuration.

### 1. Global MCP Config (`~/.cursor/mcp.json`)

```/dev/null/cursor-mcp.json#L1-22
{
  "mcpServers": {
    "mj-ellis-aegis": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.ellis-aegis.us/mcp",
        "--header",
        "Authorization:Bearer YOUR_OPERATOR_TOKEN",
        "--header",
        "x-ellis-aegis-token:YOUR_OPERATOR_TOKEN",
        "--header",
        "x-tenant-id:kevis",
        "--header",
        "x-request-id:cursor-session",
        "--header",
        "x-policy-version:mj-edge-unified-v2",
        "--header",
        "x-operator-capability:mcp.admin"
      ]
    }
  }
}
```

### 2. Project-Level MCP Config (`.cursor/mcp.json` in repo root)

Same format as above — scoped to the current project. Use this when you want per-project MCP configuration.

### 3. Cursor Settings UI

Go to Cursor → Settings → MCP, click "Add MCP Server", and enter:

| Field | Value |
|-------|-------|
| Name | `MJ Control Plane` |
| Type | `command` |
| Command | `npx -y mcp-remote https://mcp.ellis-aegis.us/mcp --header x-ellis-aegis-token:YOUR_OPERATOR_TOKEN --header x-tenant-id:kevis --header x-policy-version:mj-edge-unified-v2 --header x-operator-capability:mcp.admin` |

---

## What the Operator Hands Off to Cursor

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` |
| Operator header | `x-ellis-aegis-token` |

---

## Verification

After adding the MCP server, open Cursor's MCP panel and confirm:
- `mj-ellis-aegis` server shows as connected
- Tools listed include `health_check`, `drift_scan`, `audit_query`, `change_request`

From terminal:
```/dev/null/verify.sh#L1-8
curl https://mcp.ellis-aegis.us/healthz

export MJ_OPERATOR_TOKEN="set-in-shell"
curl -H "x-ellis-aegis-token: ${MJ_OPERATOR_TOKEN:?set MJ_OPERATOR_TOKEN}" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: cursor-test-001" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: mcp.admin" \
     https://mcp.ellis-aegis.us/mcp
```

---

## Lane Boundaries

Cursor via `mj-cursor` can:
- Read approved project context
- Call MCP tools
- Execute script.run turns
- Read audit events

Cursor **cannot**:
- Write canonical truth memory
- Read or expose secret values
- Deploy to production without approval
- Bypass MJ Core routing
