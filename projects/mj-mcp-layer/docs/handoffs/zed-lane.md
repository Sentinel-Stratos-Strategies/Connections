# Zed Lane — MJ MCP Connection Handoff

**Lane:** `mj-zed`  
**Platform:** Zed Editor (https://zed.dev)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin`, `script.run`, `forensic.read`  
**Auth Mode:** Bearer token via MCP connector config  

---

## What Zed Gets

Zed connects to the MJ control plane as an approved MCP operator. Inside Zed's AI panel and extension context, it can:

- List and call approved MCP tools (health check, drift scan, audit query, change request)
- Read system status and audit events
- Propose and plan code changes with MJ context
- Execute turns through the multi-step turn endpoint
- Receive audit projections without accessing canonical truth

---

## Zed-Side Setup

### 1. Add MCP Server to Zed settings

In your Zed `settings.json` (open with `Cmd+,` → JSON):

```/dev/null/zed-settings.json#L1-30
{
  "language_models": {},
  "context_servers": {
    "mj-ellis-aegis": {
      "command": {
        "path": "npx",
        "args": [
          "-y",
          "mcp-remote",
          "https://mcp.ellis-aegis.us/mcp",
          "--header",
          "x-ellis-aegis-token:YOUR_OPERATOR_TOKEN",
          "--header",
          "x-tenant-id:kevis",
          "--header",
          "x-policy-version:mj-edge-unified-v2",
          "--header",
          "x-operator-capability:mcp.admin"
        ]
      }
    }
  }
}
```

Replace `YOUR_OPERATOR_TOKEN` with the token issued to your Zed lane.

### 2. Alternatively — HTTP transport (native, no npx proxy)

Zed supports native HTTP MCP servers directly. When Zed ships full HTTP MCP support, use:

```/dev/null/zed-settings-http.json#L1-25
{
  "context_servers": {
    "mj-ellis-aegis": {
      "transport": "http",
      "url": "https://mcp.ellis-aegis.us/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OPERATOR_TOKEN",
        "x-ellis-aegis-token": "YOUR_OPERATOR_TOKEN",
        "x-tenant-id": "kevis",
        "x-policy-version": "mj-edge-unified-v2",
        "x-operator-capability": "mcp.admin"
      }
    }
  }
}
```

---

## What the Operator Hands Off to Zed

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per-tenant (never shared) |
| Tenant ID | `kevis` (or your assigned tenant) |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` |
| Operator header name | `x-ellis-aegis-token` |

---

## Verification

After configuring Zed, verify the connection:

```/dev/null/verify.sh#L1-10
# From terminal — confirm health
curl https://mcp.ellis-aegis.us/healthz

# Confirm MCP responds with your token
curl -H "Authorization: Bearer YOUR_OPERATOR_TOKEN" \
     -H "x-ellis-aegis-token: YOUR_OPERATOR_TOKEN" \
     -H "x-tenant-id: kevis" \
     -H "x-request-id: test-001" \
     -H "x-policy-version: mj-edge-unified-v2" \
     -H "x-operator-capability: mcp.admin" \
     https://mcp.ellis-aegis.us/mcp
```

Expected response includes `"protocol": "mcp"` and the tools list.

---

## Lane Boundaries

Zed via `mj-zed` is allowed to:
- Read code context and plan changes
- Call approved MCP tools
- Execute `script.run` turns
- Read audit events with `forensic.read`

Zed is **not** allowed to:
- Write canonical truth memory
- Read secret values
- Deploy to production without approval
- Call unapproved external endpoints
- Bypass MJ Core routing

---

## Audit

Every tool call Zed makes through this lane is recorded in the immutable audit log at `/audit/events`. The actor will be tagged as `zed-operator` with the tenant ID and request ID included in every event.
