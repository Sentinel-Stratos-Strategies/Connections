# MJ MCP Data Boundaries

MJ MCP uses strict data boundaries so platform integrations can coordinate without leaking secrets, over-sharing workspace data, or writing truth from the wrong surface.

## Memory modes

| Mode | Meaning |
| --- | --- |
| `none` | No persistent memory is written. |
| `projection_only` | Store summaries, hashes, resource links, and metadata only. |
| `doc_projection` | Store document-derived summaries and links, not raw private docs unless explicitly approved. |
| `issue_projection` | Store issue/task summaries, IDs, and workflow state. |
| `deployment_projection` | Store deployment status, URLs, commit refs, and environment labels, not secret values. |
| `audit_only` | Store audit records only. |

## Truth write boundary

External lanes must not write canonical truth memory. Truth writes are internal-only and must pass Cloudflare security policy.

```text
External platform data -> projection -> audit -> optional internal truth review
```

## Secret handling

Secret values must never be returned to:

- ChatGPT
- Codex
- Notion
- Linear
- logs
- memory projections
- audit payload bodies
- issue comments
- deployment summaries

Allowed secret operations are limited to metadata, rotation request records, and approved runtime injection paths.

## Logging boundary

Default: do not log raw payloads.

Instead log:

- action
- actor
- lane
- resource identifier
- risk level
- decision
- reason code
- source hash
- projection reference

## Cross-platform boundary

A lane may not pass raw data directly to another lane. MJ Core must normalize and redact data before dispatching a new lane action.
