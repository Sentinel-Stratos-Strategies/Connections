# OpenAI Lane — MJ MCP Connection Handoff

**Lane:** `mj-openai`  
**Platform:** OpenAI Platform / ChatGPT / Codex  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin`, `script.run`  
**Auth Mode:** API key (server-side) or OpenAI MCP connector  

---

## What OpenAI Gets

OpenAI-powered tools (ChatGPT, Codex, custom GPTs, and Response API agents) connect to the MJ control plane to:

- Call approved MCP tools from within agent responses
- Execute multi-step turns with MJ orchestration
- Push validated agent kits and tool schemas
- Access audit and ledger reads for compliance context
- Route model calls through MJ's AI Gateway policy

---

## OpenAI-Side Setup (MCP Remote Server in ChatGPT / Custom GPT)

### 1. ChatGPT → Settings → Connected apps → MCP Servers

Add a new MCP server:

| Field | Value |
|-------|-------|
| Server URL | `https://mcp.ellis-aegis.us/mcp` |
| Authentication | Bearer token |
| Token | `YOUR_OPERATOR_TOKEN` |

ChatGPT will pass the Bearer token as `Authorization: Bearer <token>`. You must also configure the additional headers — if ChatGPT does not support custom headers natively, use the proxy approach below.

### 2. Custom GPT / Action (OpenAPI schema)

Create a Custom GPT Action pointing to the MJ endpoint:

```/dev/null/openapi-action.json#L1-40
{
  "openapi": "3.1.0",
  "info": {
    "title": "MJ MCP Control Plane",
    "version": "2.0"
  },
  "servers": [
    { "url": "https://mcp.ellis-aegis.us" }
  ],
  "paths": {
    "/mcp": {
      "post": {
        "operationId": "mcpToolCall",
        "summary": "Execute an MCP tool call",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "jsonrpc": { "type": "string" },
                  "id": { "type": "integer" },
                  "method": { "type": "string" },
                  "params": { "type": "object" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Tool result" }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}
```

Set these as custom headers in your GPT Action configuration:
- `x-ellis-aegis-token: YOUR_OPERATOR_TOKEN`
- `x-tenant-id: kevis`
- `x-request-id: {auto-generated}`
- `x-policy-version: mj-edge-unified-v2`
- `x-operator-capability: mcp.admin`

### 3. OpenAI Responses API (programmatic)

```/dev/null/responses-api.py#L1-30
import openai

client = openai.OpenAI()

response = client.responses.create(
    model="gpt-4o",
    tools=[{
        "type": "mcp",
        "server_url": "https://mcp.ellis-aegis.us/mcp",
        "server_label": "mj-control-plane",
        "headers": {
            "Authorization": "Bearer YOUR_OPERATOR_TOKEN",
            "x-ellis-aegis-token": "YOUR_OPERATOR_TOKEN",
            "x-tenant-id": "kevis",
            "x-policy-version": "mj-edge-unified-v2",
            "x-operator-capability": "mcp.admin"
        }
    }],
    input="Run a health check on the MJ control plane"
)
print(response.output_text)
```

---

## What the Operator Hands Off to OpenAI

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` or `script.run` |
| Operator header | `x-ellis-aegis-token` |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `responses.create` | Create a Responses API call via MJ tool |
| `agent_kit.validate` | Validate an agent kit schema |
| `agent_kit.push` | Push a validated kit to OpenAI platform |
| `tool.call` | Execute an approved tool call |
| `file_search.query` | Query an approved vector store |

### Approval Required

- `production_agent_update` — updating a live agent
- `tool_schema_update` — changing a tool's schema
- `external_mcp_enable` — adding a new external MCP server
- `bulk_file_ingest` — large file uploads

---

## Lane Boundaries

OpenAI via `mj-openai` is **not** allowed to:
- Modify organization billing
- Escalate permissions
- Call hidden or undocumented endpoints
- Automate UI interactions
- Return secret values to chat context
