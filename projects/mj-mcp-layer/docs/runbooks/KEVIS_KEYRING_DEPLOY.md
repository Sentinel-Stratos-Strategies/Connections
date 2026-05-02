# Kevis-keyring Deploy Runbook

1. Validate worker compatibility from `apps-connectors/kevis-keyring-007/worker`
2. Apply/merge required contracts from `contracts/`
3. Route `kevis.your-domain.example/*` to `mj-edge`
4. Apply Cloudflare hardening scripts
5. Validate endpoint:
   - `curl -s -o /dev/null -w "%{http_code}" https://kevis.your-domain.example/mcp`
6. Verify action audit events in governance ledger
