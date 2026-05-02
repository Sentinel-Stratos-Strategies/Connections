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

log_json(){ printf '%s\n' "$1" >> "$LOG"; }
req(){
  local stage="$1" method="$2" path="$3" body="${4:-}"
  local out code ts
  ts="$(date -u +%FT%TZ)"; out=$(mktemp)
  if [[ -n "$body" ]]; then
    code=$(curl -sS -o "$out" -w "%{http_code}" -X "$method" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$API$path" --data "$body")
  else
    code=$(curl -sS -o "$out" -w "%{http_code}" -X "$method" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$API$path")
  fi
  log_json "$(jq -nc --arg ts "$ts" --arg stage "$stage" --arg method "$method" --arg path "$path" --arg code "$code" --argjson response "$(cat "$out")" '{ts:$ts,stage:$stage,method:$method,path:$path,http_code:($code|tonumber),response:$response}')"
  cat "$out"; rm -f "$out"
}

baseline_json=$(node -e "const fs=require('fs');const YAML=require('yaml');console.log(JSON.stringify(YAML.parse(fs.readFileSync(process.argv[1],'utf8'))));" "$BASELINE")
entry=$(req cache GET "/zones/$CF_ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint")
rs_id=$(echo "$entry" | jq -r '.result.id // empty')
if [[ -z "$rs_id" ]]; then
  create=$(req cache POST "/zones/$CF_ZONE_ID/rulesets" '{"name":"MJ MCP Cache Settings","kind":"zone","phase":"http_request_cache_settings","rules":[]}')
  rs_id=$(echo "$create" | jq -r '.result.id // empty')
fi
[[ -z "$rs_id" ]] && { echo "❌ unable to resolve cache ruleset id"; exit 2; }

rules=$(echo "$baseline_json" | jq -c '.cache_rules[]')
while IFS= read -r rule; do
  [[ -z "$rule" ]] && continue
  desc=$(echo "$rule" | jq -r '.description')
  expr=$(echo "$rule" | jq -r '.expression')
  existing=$(echo "$entry" | jq -c --arg d "$desc" '.result.rules[]? | select(.description==$d)' | head -n1)
  payload=$(jq -nc --arg d "$desc" --arg e "$expr" '{description:$d,expression:$e,action:"set_cache_settings",enabled:true,action_parameters:{cache:false}}')
  if [[ -z "$existing" ]]; then
    echo "  [+] $desc"
    req cache POST "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules" "$payload" >/dev/null
  else
    ex_id=$(echo "$existing" | jq -r '.id')
    ex_expr=$(echo "$existing" | jq -r '.expression')
    if [[ "$ex_expr" != "$expr" ]]; then
      echo "  [~] $desc"
      req cache PATCH "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules/$ex_id" "$payload" >/dev/null
    else
      echo "  [=] $desc"
    fi
  fi
done <<< "$rules"

echo "✅ cache stage complete"
