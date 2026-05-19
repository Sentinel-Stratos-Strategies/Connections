# Notion Lane — MJ MCP Connection Handoff

**Lane:** `mj-notion`  
**Platform:** Notion (https://notion.so)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `forensic.read`, `mcp.admin` (scoped)  
**Auth Mode:** Notion MCP Connector or API integration token  

---

## What Notion Gets

Notion connects to the MJ control plane to enable document-driven workflows:

- Read and update approved workspace pages and databases
- Create implementation plans and spec pages
- Write project memory projections
- Receive structured outputs from MJ agent turns

---

## Notion-Side Setup

### Option A — Notion MCP Connector (Native, Recommended)

Notion's built-in MCP connector support lets you point Notion at any MCP server.

In your Notion workspace settings → Integrations → MCP Servers, add:

| Field | Value |
|-------|-------|
| Server URL | `https://mcp.ellis-aegis.us/mcp` |
| Auth header name | `x-ellis-aegis-token` |
| Auth header value | `YOUR_OPERATOR_TOKEN` |
| Tenant ID header | `x-tenant-id: kevis` |
| Policy version | `x-policy-version: mj-edge-unified-v2` |
| Capability | `x-operator-capability: mcp.admin` |

### Option B — Notion API Integration

Create an internal integration at https://www.notion.so/my-integrations and provide the integration token to the operator. The operator will configure the MJ Notion lane to use your integration token for Notion API calls on the outbound side.

The token stays server-side and is never returned to memory or logs.

---

## What the Operator Hands Off to Notion

| Item | Value |
|------|-------|
| MCP Server URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant — contact operator |
| Tenant ID | `kevis` (or your assigned ID) |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` (for full doc workflows) or `forensic.read` (read-only) |

---

## Approved Actions

Via the `mj-notion` lane, Notion may:

| Action | Description |
|--------|-------------|
| `page.read` | Read any approved page |
| `page.create` | Create a page in an approved database |
| `page.update` | Update an approved page's content |
| `database.query` | Query a database with filters |
| `comment.create` | Add a comment to a page |

### Approval Required

These actions require explicit operator approval before execution:

- `page.delete`
- `database.bulk_update`
- `workspace.share_external`

---

## Example: MJ Reads a Notion Spec and Creates Linear Tasks

This is a typical multi-lane workflow MJ orchestrates:

1. Notion page is flagged as a spec ready for implementation
2. MJ reads the page via `mj-notion: page.read`
3. MJ normalizes the spec into an implementation plan
4. MJ creates issues in Linear via `mj-linear: issue.create`
5. MJ optionally creates a GitHub branch via `mj-github: branch.create`
6. Audit events are written for every step

No step can skip MJ Core — Notion cannot directly call Linear.

---

## Lane Boundaries

Notion via `mj-notion` is **not** allowed to:
- Export the entire workspace
- Read or reveal secret values
- Escalate permissions
- Write canonical truth memory
