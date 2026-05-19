# Vercel Lane — MJ MCP Connection Handoff

**Lane:** `mj-vercel`  
**Platform:** Vercel (https://vercel.com)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `cloud.ops`, `forensic.read`  
**Auth Mode:** Vercel API token or MCP connector  

---

## What Vercel Gets

Vercel connects to the MJ control plane to enable governed frontend deployment workflows:

- Read project and deployment metadata
- Create preview deployments with operator context
- Inspect deployment logs for audit purposes
- Submit production promotion requests (requires approval)
- Report deployment status back to MJ audit trail

---

## Vercel-Side Setup

### 1. Vercel MCP Server (Official)

Vercel publishes an official MCP server. To connect it through MJ:

In your AI assistant's MCP config (Claude Desktop, Zed, Cursor, etc.):

```/dev/null/vercel-mcp.json#L1-18
{
  "mcpServers": {
    "mj-vercel": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.ellis-aegis.us/mcp",
        "--header", "x-ellis-aegis-token:YOUR_OPERATOR_TOKEN",
        "--header", "x-tenant-id:kevis",
        "--header", "x-policy-version:mj-edge-unified-v2",
        "--header", "x-operator-capability:cloud.ops"
      ]
    }
  }
}
```

### 2. GitHub Actions Integration (Deploy Hook + MJ Gate)

```/dev/null/vercel-deploy.yml#L1-40
name: Deploy to Vercel via MJ Gate

on:
  push:
    branches: [main]

jobs:
  mj-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Submit deployment change request to MJ
        env:
          MJ_TOKEN: ${{ secrets.MJ_OPERATOR_TOKEN }}
          MJ_TENANT: ${{ secrets.MJ_TENANT_ID }}
        run: |
          curl -sf -X POST \
            -H "Authorization: Bearer $MJ_TOKEN" \
            -H "x-ellis-aegis-token: $MJ_TOKEN" \
            -H "x-tenant-id: $MJ_TENANT" \
            -H "x-request-id: $GITHUB_SHA" \
            -H "x-policy-version: mj-edge-unified-v2" \
            -H "x-operator-capability: cloud.ops" \
            -H "Content-Type: application/json" \
            -d "{\"intent\":\"vercel_production_deploy\",\"requester\":\"github-actions\",\"payload\":{\"sha\":\"$GITHUB_SHA\",\"repo\":\"$GITHUB_REPOSITORY\"}}" \
            "https://mcp.ellis-aegis.us/api/change-request"

  preview-deploy:
    needs: mj-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Preview to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## What the Operator Hands Off to Vercel

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Capability | `cloud.ops` (deploy ops) + `forensic.read` (logs) |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `project.read` | Read project metadata |
| `deployment.read` | Read deployment status and details |
| `deployment.create_preview` | Create a preview deployment |
| `deployment.logs_read` | Inspect deployment logs |
| `domain.read` | Read domain configuration |
| `env.read_metadata` | Read env var names (not values) |

### Approval Required

- `deployment.promote_production` — promote a preview to production
- `env.update` — change environment variables
- `domain.update` — update domain settings
- `project.settings_update` — change project configuration

---

## Lane Boundaries

Vercel via `mj-vercel` is **not** allowed to:
- Delete a project
- Transfer domains
- Read environment variable secret values
- Escalate permissions
