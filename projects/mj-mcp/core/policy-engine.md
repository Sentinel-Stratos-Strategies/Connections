# MJ Policy Engine

The MJ Policy Engine decides whether a normalized action envelope may execute.

## Decision inputs

- Actor identity.
- Source interface.
- Lane manifest.
- Requested action.
- Target resource.
- Risk level.
- Approval status.
- Current platform permissions.
- Data boundary policy.
- Runtime environment.

## Decisions

```text
allow
allow_with_audit
deny
require_approval
quarantine
```

## Default posture

- Deny by default.
- Audit by default.
- Least privilege by default.
- Projection memory by default.
- Human approval for high-risk or destructive operations.

## High-risk action classes

- Production deployment.
- Secret creation, rotation, or deletion.
- Permission escalation.
- Bulk deletion or bulk update.
- Domain transfer or DNS mutation.
- User impersonation.
- Workspace-wide export.
- Truth memory write.
- Cross-platform write after external read.

## Policy evaluation order

1. Actor is authenticated.
2. Source interface is approved.
3. Lane exists.
4. Action is not explicitly denied.
5. Action is explicitly allowed.
6. Target resource is in scope.
7. Data boundary allows the payload.
8. Approval exists when required.
9. Audit sink is available.
10. Runtime environment permits the action.

## Failure mode

If the policy engine cannot determine safety, it denies or requires approval. It must not guess.
