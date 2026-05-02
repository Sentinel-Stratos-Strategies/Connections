#!/usr/bin/env bash
# bootstrap-ledger.sh — first-run only. Captures current zone state as the
# "known-good" baseline. Run this AFTER you've manually verified the zone
# is in a clean state. Everything captured here is treated as authorized.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"

ART_DIR="${ART_DIR:-./artifacts}"
LEDGER="$ART_DIR/codex-ledger.jsonl"
mkdir -p "$ART_DIR"

: "${CF_API_TOKEN:?}"
: "${CF_ZONE_ID:?}"

if [[ -f "$LEDGER" ]]; then
  echo "❌ ledger already exists at $LEDGER"
  echo "   Refusing to overwrite. Move it aside first if you really mean to re-bootstrap."
  exit 1
fi

API="https://api.cloudflare.com/client/v4"
H=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

echo "🛡️  Bootstrapping Codex ledger from current zone state..."

write_entry() {
  local intent="$1"
  local payload="$2"
  local hash
  hash=$(echo -n "$payload" | sha256sum | awk '{print $1}')
  jq -nc \
    --arg ts "$(date -u +%FT%TZ)" \
    --arg intent "$intent" \
    --arg hash "$hash" \
    --argjson payload "$payload" \
    '{ts:$ts, intent:$intent, hash:$hash, source:"bootstrap", payload:$payload}' \
    >> "$LEDGER"
}

# DNS
echo "==> capturing DNS records"
DNS=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/dns_records?per_page=500")
echo "$DNS" | jq -c '.result[]?' | while read -r rec; do
  write_entry "dns_record_create" "$rec"
done

# WAF
echo "==> capturing WAF rules"
WAF=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint" || echo '{}')
echo "$WAF" | jq -c '.result.rules[]?' | while read -r r; do
  write_entry "waf_rule_create" "$r"
done

# Rate limits
echo "==> capturing rate limit rules"
RL=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" || echo '{}')
echo "$RL" | jq -c '.result.rules[]?' | while read -r r; do
  write_entry "ratelimit_rule_create" "$r"
done

# Cache
echo "==> capturing cache rules"
CACHE=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" || echo '{}')
echo "$CACHE" | jq -c '.result.rules[]?' | while read -r r; do
  write_entry "cache_rule_create" "$r"
done

# Worker routes
echo "==> capturing worker routes"
WR=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/workers/routes" || echo '{}')
echo "$WR" | jq -c '.result[]?' | while read -r r; do
  write_entry "worker_route_create" "$r"
done

LINES=$(wc -l < "$LEDGER")
echo
echo "✅ ledger bootstrapped: $LINES entries → $LEDGER"
echo "   Future scans will treat this state as authorized."
echo "   Any change after this point must come through Codex or it'll flag."
