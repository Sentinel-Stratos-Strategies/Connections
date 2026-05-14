# Linear Lane — MJ MCP Connection Handoff

**Lane:** `mj-linear`  
**Platform:** Linear (https://linear.app)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin` (scoped to issue actions)  
**Auth Mode:** Linear API key or MCP connector  

---

## What Linear Gets

Linear connects to the MJ control plane to enable implementation planning workflows:

- Receive implementation plans converted from Notion specs or MJ agent outputs
- Create, read, and update issues in approved teams and projects
- Add comments with context from MJ turns
- Track deployment status linked to issues

---

## Linear-Side Setup

### Option A — Linear MCP Server (Official)

Linear publishes an official MCP server at `@linear/mcp`. To bridge it through MJ:

```/dev/null/claude-desktop.json#L1-20
{
  "mcpServers": {
    "mj-linear": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.ellis-aegis.us/mcp",
        "--header", "x-ellis-aegis-token:YOUR_OPERATOR_TOKEN",
        "--header", "x-tenant-id:kevis",
        "--header", "x-policy-version:mj-edge-unified-v2",
        "--header", "x-operator-capability:mcp.admin"
      ]
    }
  }
}
```

### Option B — Direct API Integration

Provide your Linear API key to the operator. The MJ Linear lane will use it server-side for all Notion→Linear issue creation workflows. Your API key never appears in logs or memory.

Get your Linear API key at: Settings → Security → API keys → Personal API keys.

---

## What the Operator Hands Off to Linear

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant — contact operator |
| Tenant ID | `kevis` (or your assigned ID) |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `issue.read` | Read issue details, assignees, labels, status |
| `issue.create` | Create new issues in approved teams |
| `issue.update` | Update title, description, status, priority |
| `issue.comment` | Add a comment to an issue |
| `project.read` | Read project metadata and milestones |
| `label.read` | List available labels |

### Approval Required

- `issue.bulk_update` — bulk status changes
- `project.archive` — archiving a project
- `issue.delete` — permanent deletion

---

## Lane Boundaries

Linear via `mj-linear` is **not** allowed to:
- Delete the workspace
- Impersonate another user
- Escalate permissions
- Read or return secret values
