# Platform Architecture (Sanitized)

This codebase contains:
1. MCP Edge routing and policy enforcement
2. Multi-tenant memory runtime governance and signed control plane
3. Cloudflare hardening automation (WAF/rate-limit/cache/bot posture)
4. Drift detection and tamper-evident operational scanning
5. Connector endpoint topology for multi-agent clients

## Kevis Module
- Included integration source: `apps-connectors/kevis-keyring-007/`
- Routed via `kevis.your-domain.example` through `mj-edge`
- Uses the same policy + audit pipeline as Hitch and agent hosts
