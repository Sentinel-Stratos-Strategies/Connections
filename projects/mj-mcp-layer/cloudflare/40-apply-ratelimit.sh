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
entry=$(req ratelimit GET "/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint")
rs_id=$(echo "$entry" | jq -r '.result.id // empty')
if [[ -z "$rs_id" ]]; then
  create=$(req ratelimit POST "/zones/$CF_ZONE_ID/rulesets" '{"name":"MJ MCP Rate Limit","kind":"zone","phase":"http_ratelimit","rules":[]}')
  rs_id=$(echo "$create" | jq -r '.result.id // empty')
  entry=$(req ratelimit GET "/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint")
fi
[[ -z "$rs_id" ]] && { echo "❌ unable to resolve ratelimit ruleset id"; exit 2; }

rl_failures=0
rules=$(echo "$baseline_json" | jq -c '.rate_limits[]')
while IFS= read -r rule; do
  [[ -z "$rule" ]] && continue
  desc=$(echo "$rule" | jq -r '.description')
  expr=$(echo "$rule" | jq -r '.match_expression')
  action=$(echo "$rule" | jq -r '.action')
  rpp=$(echo "$rule" | jq -r '.requests_per_period')
  period=$(echo "$rule" | jq -r '.period_seconds')
  timeout=$(echo "$rule" | jq -r '.mitigation_timeout_seconds')
  existing=$(echo "$entry" | jq -c --arg d "$desc" '.result.rules[]? | select(.description==$d)' | head -n1)
  payload=$(jq -nc --arg d "$desc" --arg e "$expr" --arg a "$action" --argjson rpp "$rpp" --argjson p "$period" --argjson t "$timeout" '{description:$d,expression:$e,action:$a,enabled:true,ratelimit:{characteristics:["ip.src","cf.colo.id"],period:$p,requests_per_period:$rpp,mitigation_timeout:$t}}')

  want_fp=$(echo "$payload" | jq -c '{expression,action,enabled,ratelimit}' | sha256sum | cut -d' ' -f1)

  if [[ -z "$existing" ]]; then
    echo "  [+] $desc"
    result=$(req ratelimit POST "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules" "$payload") || {
      echo "  ❌ Failed to create rule: $desc"
      log_json "$(jq -nc --arg d "$desc" '{stage:"ratelimit",event:"rule_create_failed",description:$d}')"
      ((rl_failures++)) || true
      continue
    }
    ok=$(echo "$result" | jq -r '.success // false')
    if [[ "$ok" != "true" ]]; then
      echo "  ❌ API rejected rule: $desc"
      log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"ratelimit",event:"rule_create_rejected",description:$d,response:$r}')"
      ((rl_failures++)) || true
    fi
  else
    ex_id=$(echo "$existing" | jq -r '.id')
    existing_fp=$(echo "$existing" | jq -c '{expression,action,enabled,ratelimit}' | sha256sum | cut -d' ' -f1)
    if [[ "$want_fp" == "$existing_fp" ]]; then
      echo "  [=] $desc (no changes, skipping)"
      continue
    fi
    echo "  [~] $desc"
    result=$(req ratelimit PATCH "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules/$ex_id" "$payload") || {
      echo "  ❌ Failed to update rule: $desc"
      log_json "$(jq -nc --arg d "$desc" '{stage:"ratelimit",event:"rule_update_failed",description:$d}')"
      ((rl_failures++)) || true
      continue
    }
    ok=$(echo "$result" | jq -r '.success // false')
    if [[ "$ok" != "true" ]]; then
      echo "  ❌ API rejected rule update: $desc"
      log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"ratelimit",event:"rule_update_rejected",description:$d,response:$r}')"
      ((rl_failures++)) || true
    fi
  fi
done <<< "$rules"

if [[ $rl_failures -gt 0 ]]; then
  echo "⚠️ rate limit stage completed with $rl_failures failure(s)"
  exit 1
fi
echo "✅ rate limit stage complete"
