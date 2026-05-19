# MJ MCP Lane Contract

A lane is a scoped mini-MJ dedicated to one platform, tool, or operational surface.

## Lane responsibilities

Each lane must define:

- Platform identity and purpose.
- Allowed actions.
- Denied actions.
- Authentication mode.
- Memory mode.
- Audit requirements.
- Approval gates for risky actions.
- Data boundaries.
- Runtime owner and escalation path.

## Required lane behavior

1. Lanes do not call other lanes directly.
2. Cross-platform workflows must route through MJ Core.
3. Lanes may only use official APIs, documented MCP servers, approved connectors, or explicitly approved SDKs.
4. Every state-changing action must emit an audit event.
5. Reads that may influence future actions should emit a lightweight audit event or trace record.
6. Secret values must not be returned to MJ Memory, ChatGPT, Codex, Notion, Linear, or logs.
7. Bulk destructive operations require approval gates.
8. Production deploys require approval gates unless the policy engine explicitly grants automation.

## Lane isolation rule

```text
A lane owns only its platform boundary.
It cannot borrow privileges from another lane.
It cannot bypass MJ Core.
It cannot write truth memory unless explicitly internal-only.
```

## Lane manifest minimum fields

- `lane`
- `platform`
- `purpose`
- `owner`
- `authMode`
- `memoryMode`
- `allowedActions`
- `deniedActions`
- `requiresAudit`
- `requiresApprovalFor`
- `dataBoundaries`

## Runtime expectation

The lane contract is a design-time and runtime control artifact. Cloudflare Workers, local bridge CLIs, and MCP servers should read or compile from these manifests before executing platform actions.
