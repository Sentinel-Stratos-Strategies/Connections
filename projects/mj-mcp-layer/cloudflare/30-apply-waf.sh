#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"
BASELINE="${BASELINE:-$SCRIPT_DIR/security-baseline.yaml}"
ART_DIR="${ART_DIR:-./artifacts}"
LOG="$ART_DIR/run-log.jsonl"
mkdir -p "$ART_DIR"
: "${CF_API_TOKEN:?}"
: "${CF_ZONE_ID:?}"
API="https://api.cloudflare.com/client/v4"

log_json() { printf '%s\n' "$1" >> "$LOG"; }
req() {
  local stage="$1" method="$2" path="$3" body="${4:-}"
  local ts code out ray reqid
  ts="$(date -u +%FT%TZ)"
  out=$(mktemp)
  if [[ -n "$body" ]]; then
    code=$(curl -sS -o "$out" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
      "$API$path" --data "$body")
  else
    code=$(curl -sS -o "$out" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
      "$API$path")
  fi
  ray=$(grep -i '^cf-ray:' "$out" 2>/dev/null | awk -F': ' '{print $2}' | tr -d '\r' || true)
  reqid=$(jq -r '.result.id // empty' "$out" 2>/dev/null || true)
  log_json "$(jq -nc --arg ts "$ts" --arg stage "$stage" --arg method "$method" --arg path "$path" --arg code "$code" --arg ray "${ray:-}" --arg reqid "${reqid:-}" --argjson body "$(cat "$out" 2>/dev/null || echo '{}')" '{ts:$ts,stage:$stage,method:$method,path:$path,http_code:($code|tonumber),cf_ray:$ray,result_id:$reqid,response:$body}')"
  cat "$out"
  rm -f "$out"
}

baseline_json=$(node -e "const fs=require('fs');const YAML=require('yaml');const p=YAML.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(p));" "$BASELINE")

echo "==> WAF apply"
entry=$(req waf GET "/zones/$CF_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint")
rs_id=$(echo "$entry" | jq -r '.result.id // empty')
if [[ -z "$rs_id" ]]; then
  create=$(req waf POST "/zones/$CF_ZONE_ID/rulesets" '{"name":"MJ MCP Custom WAF","kind":"zone","phase":"http_request_firewall_custom","rules":[]}')
  rs_id=$(echo "$create" | jq -r '.result.id // empty')
  entry=$(req waf GET "/zones/$CF_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint")
fi
[[ -z "$rs_id" ]] && { echo "❌ unable to resolve waf ruleset id"; exit 2; }

waf_failures=0
rules=$(echo "$baseline_json" | jq -c '.waf_rules[]')
while IFS= read -r rule; do
  [[ -z "$rule" ]] && continue
  desc=$(echo "$rule" | jq -r '.description')
  expr=$(echo "$rule" | jq -r '.expression')
  action=$(echo "$rule" | jq -r '.action')
  existing=$(echo "$entry" | jq -c --arg d "$desc" '.result.rules[]? | select(.description==$d)' | head -n1)
  payload=$(jq -nc --arg d "$desc" --arg e "$expr" --arg a "$action" '{description:$d,expression:$e,action:$a,enabled:true}')

  want_fingerprint=$(echo "$payload" | jq -c '{expression,action}' | sha256sum | cut -d' ' -f1)

  if [[ -z "$existing" ]]; then
    echo "  [+] $desc"
    result=$(req waf POST "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules" "$payload") || {
      echo "  ❌ Failed to create rule: $desc"
      log_json "$(jq -nc --arg d "$desc" '{stage:"waf",event:"rule_create_failed",description:$d}')"
      ((waf_failures++)) || true
      continue
    }
    ok=$(echo "$result" | jq -r '.success // false')
    if [[ "$ok" != "true" ]]; then
      echo "  ❌ API rejected rule: $desc"
      log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"waf",event:"rule_create_rejected",description:$d,response:$r}')"
      ((waf_failures++)) || true
    fi
  else
    ex_id=$(echo "$existing" | jq -r '.id')
    existing_fingerprint=$(echo "$existing" | jq -c '{expression,action}' | sha256sum | cut -d' ' -f1)
    if [[ "$want_fingerprint" == "$existing_fingerprint" ]]; then
      echo "  [=] $desc (no changes, skipping)"
      continue
    fi
    echo "  [~] $desc"
    result=$(req waf PATCH "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules/$ex_id" "$payload") || {
      echo "  ❌ Failed to update rule: $desc"
      log_json "$(jq -nc --arg d "$desc" '{stage:"waf",event:"rule_update_failed",description:$d}')"
      ((waf_failures++)) || true
      continue
    }
    ok=$(echo "$result" | jq -r '.success // false')
    if [[ "$ok" != "true" ]]; then
      echo "  ❌ API rejected rule update: $desc"
      log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"waf",event:"rule_update_rejected",description:$d,response:$r}')"
      ((waf_failures++)) || true
    fi
  fi
done <<< "$rules"

if [[ $waf_failures -gt 0 ]]; then
  echo "⚠️ WAF stage completed with $waf_failures failure(s)"
  exit 1
fi
echo "✅ WAF stage complete"
