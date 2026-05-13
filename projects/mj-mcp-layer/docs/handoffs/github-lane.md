# GitHub Lane — MJ MCP Connection Handoff

**Lane:** `mj-github`  
**Platform:** GitHub / GitHub Actions  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `forensic.read`, `cloud.ops`  
**Auth Mode:** GitHub OIDC (preferred) or Personal Access Token  

---

## What GitHub Gets

GitHub Actions workflows and automation can authenticate to the MJ control plane to:

- Submit change requests for operator approval before infrastructure changes
- Query the audit ledger for compliance verification
- Dispatch drift scans and security checks
- Read asset and incident status during CI runs

---

## GitHub Actions Setup

### 1. Add Required Secrets to Your Repo

In your GitHub repository → Settings → Secrets and variables → Actions:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `MJ_OPERATOR_TOKEN` | Issued by operator | Bearer token for MJ lane |
| `MJ_MCP_BASE_URL` | `https://mcp.ellis-aegis.us` | MCP base URL |
| `MJ_TENANT_ID` | `kevis` | Your tenant ID |

### 2. Workflow Step Example

```/dev/null/mj-check.yml#L1-45
name: MJ Change Request Gate

on:
  pull_request:
    branches: [main]

jobs:
  mj-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Submit change request to MJ
        env:
          MJ_TOKEN: ${{ secrets.MJ_OPERATOR_TOKEN }}
          MJ_BASE: ${{ secrets.MJ_MCP_BASE_URL }}
          MJ_TENANT: ${{ secrets.MJ_TENANT_ID }}
        run: |
          RESPONSE=$(curl -sf -X POST \
            -H "Authorization: Bearer $MJ_TOKEN" \
            -H "x-ellis-aegis-token: $MJ_TOKEN" \
            -H "x-tenant-id: $MJ_TENANT" \
            -H "x-request-id: $GITHUB_RUN_ID" \
            -H "x-policy-version: mj-edge-unified-v2" \
            -H "x-operator-capability: cloud.ops" \
            -H "Content-Type: application/json" \
            -d "{
              \"intent\": \"pr_merge_gate\",
              \"requester\": \"github-actions\",
              \"payload\": {
                \"repo\": \"$GITHUB_REPOSITORY\",
                \"pr\": \"$GITHUB_REF\",
                \"sha\": \"$GITHUB_SHA\"
              }
            }" \
            "$MJ_BASE/api/change-request")
          echo "MJ Change Request: $RESPONSE"

      - name: Query MJ audit for recent events
        env:
          MJ_TOKEN: ${{ secrets.MJ_OPERATOR_TOKEN }}
          MJ_BASE: ${{ secrets.MJ_MCP_BASE_URL }}
          MJ_TENANT: ${{ secrets.MJ_TENANT_ID }}
        run: |
          curl -sf \
            -H "Authorization: Bearer $MJ_TOKEN" \
            -H "x-ellis-aegis-token: $MJ_TOKEN" \
            -H "x-tenant-id: $MJ_TENANT" \
            -H "x-request-id: audit-$GITHUB_RUN_ID" \
            -H "x-policy-version: mj-edge-unified-v2" \
            -H "x-operator-capability: forensic.read" \
            "$MJ_BASE/audit/events?limit=20"
```

### 3. GitHub OIDC (Recommended — No Static Secret)

For repos that support OIDC, the MJ control plane can validate the GitHub OIDC JWT directly. Contact the operator to configure OIDC trust for your org and repo. When configured, replace the static token with:

```/dev/null/oidc-step.yml#L1-20
- name: Get GitHub OIDC token
  id: oidc
  uses: actions/github-script@v7
  with:
    script: |
      const token = await core.getIDToken('https://mcp.ellis-aegis.us');
      core.setOutput('token', token);

- name: Call MJ with OIDC token
  run: |
    curl -sf \
      -H "Authorization: Bearer ${{ steps.oidc.outputs.token }}" \
      -H "x-ellis-aegis-token: ${{ steps.oidc.outputs.token }}" \
      -H "x-tenant-id: ${{ secrets.MJ_TENANT_ID }}" \
      -H "x-request-id: $GITHUB_RUN_ID" \
      -H "x-policy-version: mj-edge-unified-v2" \
      -H "x-operator-capability: cloud.ops" \
      "${{ secrets.MJ_MCP_BASE_URL }}/api/checks/run" \
      -d '{"kind":"drift"}'
```

---

## Lane Boundaries

GitHub via `mj-github` is allowed to:
- `repo.read`, `file.read`, `branch.read`, `branch.create`
- `issue.read`, `issue.create`, `issue.comment`
- `pr.read`, `pr.create`, `pr.comment`
- `workflow.status_read`

GitHub is **not** allowed to:
- `repo.delete` or `org.permission.escalate`
- `secret.read` or `secret.value_reveal`
- `branch.force_push_main`

These require explicit operator approval gates before execution.
