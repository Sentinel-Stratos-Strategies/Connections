# Google Lane — MJ MCP Connection Handoff

**Lane:** `mj-google`  
**Platform:** Google Workspace / Firebase / Google Cloud / Gemini  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin` (scoped), `cloud.ops`  
**Auth Mode:** Service account JSON or OAuth (server-side, hybrid)  

---

## What Google Gets

Google Workspace, Firebase, Google Cloud, and Gemini connect to the MJ control plane to enable governed AI and cloud workflows:

- Read approved Google Drive files and Workspace profiles
- Read and write scoped Firestore data
- Call Vertex AI and Gemini models through MJ's AI Gateway policy
- Read Firebase project status
- Route model calls with audit visibility

---

## Google-Side Setup

### Option A — Service Account (Recommended for Server Workflows)

1. Create a service account in Google Cloud Console with minimal required scopes
2. Download the JSON key file
3. Provide the JSON to the operator — it stays server-side and is never logged or returned
4. The operator configures the MJ Google lane to use this service account for outbound Workspace/Firebase/Cloud calls

### Option B — OAuth (For User-Delegated Access)

1. Configure an OAuth 2.0 client in Google Cloud Console
2. Provide the client ID and secret to the operator
3. MJ manages the OAuth flow server-side with appropriate scope restrictions

### Option C — Google MCP Server

If using Google's agent-to-agent or Gemini API with MCP support:

```/dev/null/google-mcp.json#L1-18
{
  "mcpServers": {
    "mj-google": {
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

---

## What the Operator Hands Off to Google

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` (Workspace/Firebase workflows) |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `workspace.profile.read` | Read user profile |
| `drive.file.read_approved` | Read approved Drive files |
| `firebase.project.read` | Read Firebase project info |
| `firebase.firestore.read` | Read Firestore data |
| `firebase.firestore.write_scoped` | Write to approved Firestore paths |
| `vertex.model.call` | Call Vertex AI model |
| `gemini.model.call` | Call Gemini model |

### Approval Required

- `firebase.production_write`
- `gcp.iam.update`
- `service_account.create`
- `vertex.endpoint.deploy`
- `drive.external_share`

---

## Lane Boundaries

Google via `mj-google` is **not** allowed to:
- Export all Workspace data
- Bulk delete admin directory resources
- Escalate IAM permissions
- Reveal service account key values
