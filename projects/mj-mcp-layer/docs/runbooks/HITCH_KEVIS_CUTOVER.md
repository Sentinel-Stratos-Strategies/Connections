# Hitch + Kevis Cutover Runbook

## DNS targets
- hitch.ellis-aegis.us -> mj-edge worker route
- kevis.ellis-aegis.us -> mj-edge worker route
- codex/cursor/gemini/chatgpt subdomains -> mj-edge worker route

## Order
1. Create DNS records in Cloudflare.
2. Apply worker routes.
3. Apply WAF/rate-limit/cache policy scripts.
4. Validate `/mcp` = 200 for each hostname.
5. Validate `/turn/*` method enforcement.

## Validation commands
- curl -s -o /dev/null -w "%{http_code}" https://hitch.ellis-aegis.us/mcp
- curl -s -o /dev/null -w "%{http_code}" https://kevis.ellis-aegis.us/mcp
- curl -s -o /dev/null -w "%{http_code}" https://codex.ellis-aegis.us/mcp
- curl -s -o /dev/null -w "%{http_code}" https://cursor.ellis-aegis.us/mcp
- curl -s -o /dev/null -w "%{http_code}" https://gemini.ellis-aegis.us/mcp
- curl -s -o /dev/null -w "%{http_code}" https://chatgpt.ellis-aegis.us/mcp
