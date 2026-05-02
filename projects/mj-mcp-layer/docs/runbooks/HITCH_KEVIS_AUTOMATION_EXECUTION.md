# Hitch + Kevis Automation Execution

## Preconditions
- NS for `hitch.guru` and `kevis.online` already delegated to Cloudflare.
- `CF_API_TOKEN` and `CF_ZONE_ID` available in CI secrets for each zone workflow.

## Apply Order
1. Zone DNS manifests review (`manifests/zones/*.yaml`)
2. Tenant manifests review (`manifests/tenants/*.yaml`)
3. Policy manifest review (`manifests/policies/mj-edge-unified-v2.yaml`)
4. Run hardening workflow
5. Run scan workflow
6. Verify endpoint health + audit outputs

## Verification
- hitch.guru returns expected app/edge response
- kevis.online returns expected app/edge response
- MCP hosts return 200 on `/mcp`
- unauthorized method/path calls are blocked
