# MJ Brady Shell Service

Governed shell execution service for MJ Brady.

## Features

- Authenticated WebSockets (operator token + origin check).
- Governed execution (allowlist/confirm/block).
- Redacted output (secrets scrubbed from PTY stream).
- Audited (every command and session event sent to MJ Layer ledger).
- PTY-backed (full terminal interaction support).

## Deployment

Deploy to Fly.io:

```bash
fly deploy
```

## Environment Variables

- `OPERATOR_TOKEN_HASH`: Bcrypt hash of the secret operator token.
- `MCP_BASE_URL`: URL of the MJ Layer Worker.
- `ALLOWED_ORIGINS`: Comma-separated list of allowed WebSocket origins.

## Protocol

Communication is via JSON messages over WebSockets. See `src/protocol.ts` for schemas.
