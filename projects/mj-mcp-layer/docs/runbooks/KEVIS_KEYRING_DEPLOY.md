# Kevis-keyring Deploy Runbook

1. Validate worker compatibility from `apps-connectors/kevis-keyring-007/worker`
2. Apply/merge required contracts from `contracts/`
3. Route `kevis.ellis-aegis.us/*` to `mj-edge`
4. Apply Cloudflare hardening scripts
5. Validate endpoint:
   - `curl -s -o /dev/null -w "%{http_code}" https://kevis.ellis-aegis.us/mcp`
6. Verify action audit events in governance ledger
