#!/usr/bin/env bash
# 10-inventory-cf.sh — snapshot current rulesets
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"

ART_DIR="${ART_DIR:-./artifacts}"
SUFFIX="${1:-before}"
mkdir -p "$ART_DIR"

: "${CF_API_TOKEN:?}"
: "${CF_ZONE_ID:?}"

API="https://api.cloudflare.com/client/v4"
H=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

echo "==> listing rulesets"
curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets" \
  | jq '.' > "$ART_DIR/inventory-rulesets-$SUFFIX.json"

echo "==> fetching firewall_custom phase entrypoint"
curl -sS "${H[@]}" \
  "$API/zones/$CF_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint" \
  | jq '.' > "$ART_DIR/inventory-waf-$SUFFIX.json" || true

echo "==> fetching ratelimit phase entrypoint"
curl -sS "${H[@]}" \
  "$API/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" \
  | jq '.' > "$ART_DIR/inventory-ratelimit-$SUFFIX.json" || true

echo "==> fetching cache_settings phase entrypoint"
curl -sS "${H[@]}" \
  "$API/zones/$CF_ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" \
  | jq '.' > "$ART_DIR/inventory-cache-$SUFFIX.json" || true

# consolidated snapshot
jq -n \
  --slurpfile rs "$ART_DIR/inventory-rulesets-$SUFFIX.json" \
  --slurpfile waf "$ART_DIR/inventory-waf-$SUFFIX.json" \
  --slurpfile rl "$ART_DIR/inventory-ratelimit-$SUFFIX.json" \
  --slurpfile cache "$ART_DIR/inventory-cache-$SUFFIX.json" \
  '{rulesets:$rs[0], waf:$waf[0], ratelimit:$rl[0], cache:$cache[0]}' \
  > "$ART_DIR/inventory-$SUFFIX.json"

echo "✅ inventory written: $ART_DIR/inventory-$SUFFIX.json"
