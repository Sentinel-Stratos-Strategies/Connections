# MJ Core Router

MJ Core is the central router for platform intent. It receives requests from approved operators, normalizes those requests into lane actions, checks policy, and dispatches only the minimum required work to each lane.

## Inputs

- Operator prompt or command.
- Source interface: Codex, ChatGPT, CLI, approved UI, automation.
- Actor identity.
- Requested platform or inferred platform.
- Target resource.
- Desired action.
- Risk level.

## Output

A normalized action envelope:

```json
{
  "actor": "operator-or-service-id",
  "source": "codex|chatgpt|cli|ui|automation",
  "lane": "mj-linear",
  "action": "issue.create",
  "resource": "linear/team/project",
  "payloadRef": "projection-or-request-id",
  "risk": "low|medium|high|critical",
  "requiresApproval": false
}
```

## Routing rules

1. If the request names a platform, route to that lane.
2. If the request spans multiple platforms, split into ordered lane actions.
3. If any action is destructive, privileged, external-write, or production-impacting, request approval.
4. If the platform lane does not exist, return `lane_not_configured`.
5. If an action is not listed in `allowedActions`, deny by default.
6. If an action is listed in `deniedActions`, deny even if it appears elsewhere.

## Multi-lane workflow example

Request:

```text
Turn this Notion spec into Linear tasks and deploy a Vercel preview.
```

Plan:

```text
1. mj-notion: page.read
2. mj-core: normalize implementation plan
3. mj-linear: issue.create
4. mj-github: branch.create / pr.create
5. mj-vercel: deployment.create_preview
6. mj-cloudflare: audit.record / security.check
```

## No sideways calls

Lanes cannot call each other. MJ Core is the only cross-lane coordinator.
