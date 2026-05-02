# Hitch + Kevis Cutover Runbook

## DNS targets
- hitch.your-domain.example -> mj-edge worker route
- kevis.your-domain.example -> mj-edge worker route
- codex/cursor/gemini/chatgpt subdomains -> mj-edge worker route

## Order
1. Create DNS records in Cloudflare.
2. Apply worker routes.
3. Apply WAF/rate-limit/cache policy scripts.
4. Validate `/mcp` = 200 for each hostname.
5. Validate `/turn/*` method enforcement.

## Validation commands
- curl -s -o /dev/null -w "%{http_code}" https://hitch.your-domain.example/mcp
- curl -s -o /dev/null -w "%{http_code}" https://kevis.your-domain.example/mcp
- curl -s -o /dev/null -w "%{http_code}" https://codex.your-domain.example/mcp
- curl -s -o /dev/null -w "%{http_code}" https://cursor.your-domain.example/mcp
- curl -s -o /dev/null -w "%{http_code}" https://gemini.your-domain.example/mcp
- curl -s -o /dev/null -w "%{http_code}" https://chatgpt.your-domain.example/mcp
