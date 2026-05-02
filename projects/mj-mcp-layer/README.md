# MJ MCP Layer

Sanitized MJ Edge + MCP deployment package for Cloudflare.

## Includes
- `mcp-layer/`: Worker edge implementation
- `manifests/`: zone, tenant, and policy manifests
- `cloudflare/`: hardening and drift scan automation scripts
- `docs/runbooks/`: operational execution guides

## Deploy flow
1. Set GitHub secrets for target zone IDs and API token.
2. Apply hardening scripts from `cloudflare/`.
3. Deploy worker from `mcp-layer/`.
4. Validate `/mcp` and `/turn/*` behavior.
