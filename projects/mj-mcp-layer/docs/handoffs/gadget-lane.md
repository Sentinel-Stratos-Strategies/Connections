# Gadget Lane — MJ MCP Connection Handoff

**Lane:** `mj-gadget`  
**Platform:** Gadget (https://gadget.dev)  
**MCP Endpoint:** `https://mcp.ellis-aegis.us/mcp`  
**Capabilities:** `mcp.admin` (scoped), `cloud.ops`  
**Auth Mode:** Gadget API key (server-side)  

---

## What Gadget Gets

Gadget connects to the MJ control plane for governed backend builder workflows:

- Read app metadata, models, and API definitions
- Read deployment and environment status
- Receive implementation planning context from MJ agent turns
- Submit production mutations through the approval gate

---

## Gadget-Side Setup

### 1. Gadget Environment Variables

In your Gadget app → Settings → Environment variables, add:

| Variable | Value |
|----------|-------|
| `MJ_MCP_URL` | `https://mcp.ellis-aegis.us/mcp` |
| `MJ_OPERATOR_TOKEN` | Issued by operator |
| `MJ_TENANT_ID` | `kevis` |
| `MJ_POLICY_VERSION` | `mj-edge-unified-v2` |

### 2. Gadget Action that Calls MJ

In your Gadget app's actions, use the built-in `fetch` to call MJ:

```/dev/null/gadget-action.js#L1-25
export async function run({ params, logger, api, connections }) {
  const mjResponse = await fetch("https://mcp.ellis-aegis.us/api/change-request", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MJ_OPERATOR_TOKEN}`,
      "x-ellis-aegis-token": process.env.MJ_OPERATOR_TOKEN,
      "x-tenant-id": process.env.MJ_TENANT_ID,
      "x-request-id": `gadget-${Date.now()}`,
      "x-policy-version": process.env.MJ_POLICY_VERSION,
      "x-operator-capability": "cloud.ops",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "gadget_production_mutation",
      requester: "gadget-action",
      payload: { model: params.modelName, action: params.actionName }
    })
  });
  
  const result = await mjResponse.json();
  logger.info("MJ change request submitted", { result });
  return { success: true, changeRequestId: result.id };
}
```

### 3. Provide Your Gadget API Key

Provide your Gadget API key to the operator. The MJ Gadget lane uses it server-side for app reads. Your key is never returned in responses or logs.

---

## What the Operator Hands Off to Gadget

| Item | Value |
|------|-------|
| MCP URL | `https://mcp.ellis-aegis.us/mcp` |
| Operator token | Issued per tenant |
| Tenant ID | `kevis` |
| Policy version | `mj-edge-unified-v2` |
| Capability | `mcp.admin` or `cloud.ops` |

---

## Approved Actions

| Action | Description |
|--------|-------------|
| `app.read` | Read app metadata and settings |
| `model.read` | Read model definitions |
| `api.read` | Read API endpoint definitions |
| `deployment.read` | Read deployment status |
| `implementation.plan` | Receive an implementation plan from MJ |

### Approval Required

- `production_deploy`
- `schema.update`
- `api.write`
- `data.bulk_mutation`

---

## Lane Boundaries

Gadget via `mj-gadget` is **not** allowed to:
- Delete the app
- Escalate permissions
- Read secret values
- Dump all production data
