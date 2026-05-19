# Railway Lane — MJ MCP Connection Handoff

**Lane:** `mj-railway`  
**Platform:** Railway (https://railway.app)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `cloud.ops`, `forensic.read`  
**Auth Mode:** Railway API token (server-side)  

---

## What Railway Gets

Railway connects to the MJ control plane for governed backend service deployment workflows:

- Read service, environment, and deployment metadata
- Create preview deployments with operator context
- Read deployment logs for audit and debugging
- Submit production promotion change requests
- Track variable metadata (names only, not values)

---

## Railway-Side Setup

### 1. Environment Variables in Your Railway Service

Add these to your Railway service's environment variables (Railway Dashboard → Project → Variables):

| Variable | Value |
|----------|-------|
| `MJ_MCP_URL` | `https://mcp.ellis-aegis.us/mcp` |
| `MJ_OPERATOR_TOKEN` | Issued by operator |
| `MJ_TENANT_ID` | `kevis` |
| `MJ_POLICY_VERSION` | `mj-edge-unified-v2` |

### 2. GitHub Actions Integration

If your Railway project deploys from GitHub, add MJ gates to your workflow:

```/dev/null/railway-deploy.yml#L1-30
name: Railway Deploy via MJ Gate

on:
  push:
    branches: [main]

jobs:
  mj-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Submit deployment change request
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
            -d "{\"intent\":\"railway_production_deploy\",\"requester\":\"github-actions\",\"payload\":{\"sha\":\"$GITHUB_SHA\"}}" \
            "https://mcp.ellis-aegis.us/api/change-request"
```

---

## What the Operator Hands Off to Railway

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Capability | `cloud.ops` + `forensic.read` |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `project.read` | Read project metadata |
| `service.read` | Read service details |
| `environment.read` | Read environment info |
| `deployment.read` | Read deployment status |
| `deployment.logs_read` | Read deployment logs |
| `deployment.create_preview` | Create preview deployment |
| `variable.read_metadata` | Read variable names (not values) |

### Approval Required

- `deployment.promote_production`
- `variable.update`
- `service.settings_update`
- `environment.delete`

---

## Lane Boundaries

Railway via `mj-railway` is **not** allowed to:
- Delete a project or service
- Read variable secret values
- Escalate permissions
