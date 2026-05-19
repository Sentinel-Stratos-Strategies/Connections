# MJ MCP Approval Gates

Approval gates prevent MJ lanes from performing high-impact actions without explicit operator consent.

## Always require approval

- Production deployments.
- Remote database schema migrations.
- DNS updates.
- Domain transfer or deletion.
- Environment variable updates.
- Secret creation, rotation, or deletion.
- Service account creation.
- IAM or permission changes.
- Bulk delete or bulk update.
- External sharing of private docs or workspace data.
- Any action classified as `critical` by platform policy.

## Approval record

An approval record should include:

```json
{
  "approvalId": "approval_...",
  "createdAt": "2026-05-12T00:00:00.000Z",
  "actor": "Sentinel",
  "lane": "mj-vercel",
  "action": "deployment.promote_production",
  "resource": "project/deployment",
  "risk": "high",
  "expiresAt": "2026-05-12T01:00:00.000Z",
  "decision": "approved"
}
```

## Expiration

Approvals should expire. A stale approval must not be reused for a later production-impacting action.

## Human-readable prompt

Before requesting approval, MJ Core should summarize:

- What will happen.
- Which lane will execute it.
- Which platform will be affected.
- What data or resource will change.
- How to roll back, if known.

## Deny by silence

No response is not approval. If the approval is missing, expired, or ambiguous, deny or pause.
