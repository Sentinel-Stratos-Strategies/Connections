# Cloud Shell Catch-Up Spec

## Why this exists

MJ Layer started as a cloud-shell-centered control surface. The enterprise buildout added a strong governance platform: policy compiler, ledger, evidence, runtime verification, capability visas, mutation budgets, provider adapters, and the agent court. The shell now needs to catch up so it does not become an unsafe side door or an undefined product promise.

This document defines the minimum cloud shell contract that must exist before the enterprise platform is treated as complete.

## Product intent

The cloud shell is not a generic terminal bolted onto the platform. It is a governed execution lane for operator and agent actions.

```text
Operator / Agent Intent
  -> MJ Core policy check
  -> Capability visa + mutation budget
  -> Cloud shell session
  -> Command execution sandbox
  -> Streaming output
  -> Audit + evidence bundle
  -> Ledger receipt
```

The shell should feel like a command center, but behave like an airlock.

## Non-negotiable rules

1. No shell action bypasses MJ policy.
2. No shell session receives standing production privileges.
3. No command executes without actor, tenant, request id, policy version, and capability scope.
4. No stdout/stderr payload is stored raw if it may contain secrets.
5. Every privileged command spends mutation budget.
6. Every command receives a signed receipt or explicit denial.
7. Every shell transcript is evidence, not loose log soup.

## Session lifecycle

### Create session

Creates a bounded execution session.

```json
{
  "actor": "operator-or-agent-id",
  "tenant": "operator|kevis|hitch|ellis",
  "purpose": "deploy diagnostics",
  "capability": "shell.readonly|shell.diagnostics|shell.deploy|shell.breakglass",
  "ttl_minutes": 15,
  "cwd": "/workspace",
  "env_profile": "readonly|staging|production-approved"
}
```

### Attach session

Attaches to an existing session if the caller still has valid capability.

### Execute command

Runs one command inside a session.

```json
{
  "session_id": "shellsess_...",
  "request_id": "uuid-v4",
  "command": "npm --prefix projects/mj-mcp-layer/platform test",
  "mode": "exec",
  "timeout_seconds": 120,
  "expect_mutation": false
}
```

### Stream output

Streams redacted output events.

```json
{
  "event": "stdout|stderr|exit|timeout|policy_denial",
  "sequence": 12,
  "redacted": true,
  "payload_ref": "r2://evidence/shell/.../stdout.part-12.txt",
  "sha256": "..."
}
```

### Cancel session

Stops active process and records cancellation reason.

### Close session

Closes shell, writes transcript manifest, emits ledger entry, and attaches evidence to the deployment/change request.

## Proposed API routes

These can be Worker routes, CLI commands, or MCP tools. The API route names are suggestions.

```text
POST /api/shell/session
GET  /api/shell/session/:id
POST /api/shell/session/:id/execute
GET  /api/shell/session/:id/events
POST /api/shell/session/:id/cancel
POST /api/shell/session/:id/close
```

## Proposed MCP tools

```text
shell.session.create
shell.session.attach
shell.command.plan
shell.command.execute
shell.command.cancel
shell.session.close
shell.transcript.export
```

## Capability tiers

| Capability | Allowed | Denied | Approval |
|---|---|---|---|
| shell.readonly | `pwd`, `ls`, `cat` on approved files, `git status`, `npm test` | writes, deploys, secrets, network mutation | no |
| shell.diagnostics | read-only checks, logs, health probes, dry-runs | provider mutation, deploy, secret read | no for staging, yes for prod |
| shell.deploy | deploy commands, migrations, hardening scripts | secret printing, disabling scans, destructive shell | yes |
| shell.breakglass | bounded incident commands | permanent auth changes, scan disablement | two-step approval + TTL |

## Denied command classes

The shell must block or require elevated approval for:

```text
printenv
cat .env
cat *secret*
base64 decode of secret paths
curl metadata service
cloud provider token dump
rm -rf /
disable security scans
delete ledger/evidence
modify baseline without change request
exfiltrate artifacts to unapproved URL
```

## Mutation budget mapping

| Command pattern | Budget category |
|---|---|
| `wrangler deploy` | worker_route_modify or deploy_modify |
| `wrangler d1 execute --remote` | database_mutation |
| `bash cloudflare/30-apply-waf.sh` | waf_modify |
| `bash cloudflare/40-apply-ratelimit.sh` | ratelimit_modify |
| `bash cloudflare/sentinel-scan.sh` | scan_readonly |
| `gh pr merge` | code_merge |
| `terraform apply` | infrastructure_apply |

Budget spend should be atomic: check, reserve, execute, finalize.

## Evidence model

Each shell session writes a transcript manifest.

```json
{
  "session_id": "shellsess_...",
  "actor": "operator",
  "tenant": "ellis",
  "capability": "shell.deploy",
  "created_at": "ISO-8601",
  "closed_at": "ISO-8601",
  "commands": [
    {
      "request_id": "uuid-v4",
      "command_hash": "sha256:...",
      "command_redacted": "npm --prefix projects/mj-mcp-layer/platform test",
      "cwd": "/workspace",
      "exit_code": 0,
      "started_at": "ISO-8601",
      "ended_at": "ISO-8601",
      "stdout_ref": "r2://...",
      "stderr_ref": "r2://...",
      "budget_spend_ref": "ledger:...",
      "receipt_ref": "receipts/...json"
    }
  ]
}
```

## Runtime verifier rules

Minimum shell monitors:

1. A shell command cannot execute without a valid session.
2. A session cannot outlive its TTL.
3. A command marked `expect_mutation=false` cannot call mutation-class commands.
4. A command with mutation-class behavior must spend budget.
5. A command producing suspected secret output must redact before persistence.
6. A shell session must close with a transcript manifest.

## Digital twin integration

Before privileged shell commands execute, the platform should simulate the outcome when possible:

```text
terraform plan before terraform apply
wrangler deploy --dry-run before wrangler deploy
policy compiler plan before hardening script
rollback recipe before production mutation
```

## CI/CD integration

Add a cloud-shell contract test suite:

```text
projects/mj-mcp-layer/platform/tests/cloud-shell-contract.test.ts
```

Required tests:

- readonly sessions deny mutation commands
- deploy sessions require approval metadata
- expired sessions reject commands
- secret-looking output is redacted
- transcript manifests include command hashes and exit codes
- mutation commands spend budget
- denied commands generate policy denial events

## Implementation stages

### Stage A: Contract only

- Add schemas for session, command, event, transcript.
- Add tests against pure policy functions.
- No real command execution yet.

### Stage B: Local sandbox executor

- Node child process executor for local/dev only.
- Allowlist commands.
- Timeouts and redaction.
- Transcript manifest written locally.

### Stage C: Worker/control-plane integration

- Worker issues shell session intents.
- Actual execution remains in approved runner, not inside the Worker.
- Runner returns signed receipts and transcript refs.

### Stage D: Cloud runner

- Bound execution environment with no standing privileges.
- Capability visas and mutation budgets enforced server-side.
- Evidence bundle integration.

## Open design decision

The safest architecture is likely:

```text
Worker = control plane and policy gate
Runner = execution plane
Ledger/Evidence = proof plane
```

Do not run arbitrary shell commands directly inside the Worker. Use the Worker to authorize, queue, stream, and receipt shell actions.

## Definition of done

Cloud shell is caught up when:

- The repo has schemas, tests, and docs for shell lifecycle.
- The CLI can create a dry-run shell plan.
- The platform can deny unsafe commands before execution.
- Shell outputs become evidence bundle entries.
- Privileged shell commands require capability visa + mutation budget.
- PR #5 cannot claim enterprise readiness without passing shell contract tests.
