#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"
BASELINE="${BASELINE:-./docs/security-baseline.yaml}"
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
fi
[[ -z "$rs_id" ]] && { echo "❌ unable to resolve waf ruleset id"; exit 2; }

rules=$(echo "$baseline_json" | jq -c '.waf_rules[]')
while IFS= read -r rule; do
  [[ -z "$rule" ]] && continue
  desc=$(echo "$rule" | jq -r '.description')
  expr=$(echo "$rule" | jq -r '.expression')
  action=$(echo "$rule" | jq -r '.action')
  existing=$(echo "$entry" | jq -c --arg d "$desc" '.result.rules[]? | select(.description==$d)' | head -n1)
  payload=$(jq -nc --arg d "$desc" --arg e "$expr" --arg a "$action" '{description:$d,expression:$e,action:$a,enabled:true}')
  if [[ -z "$existing" ]]; then
    echo "  [+] $desc"
    req waf POST "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules" "$payload" >/dev/null
  else
    ex_id=$(echo "$existing" | jq -r '.id')
    ex_expr=$(echo "$existing" | jq -r '.expression')
    if [[ "$ex_expr" != "$expr" ]]; then
      echo "  [~] $desc"
      req waf PATCH "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules/$ex_id" "$payload" >/dev/null
    else
      echo "  [=] $desc"
    fi
  fi
done <<< "$rules"

echo "✅ WAF stage complete"
