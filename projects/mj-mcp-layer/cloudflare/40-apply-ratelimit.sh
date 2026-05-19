#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"
BASELINE="${BASELINE:-$SCRIPT_DIR/security-baseline.yaml}"
ART_DIR="${ART_DIR:-./artifacts}"
LOG="$ART_DIR/run-log.jsonl"
DEFERRED="$ART_DIR/control-deferrals.jsonl"
mkdir -p "$ART_DIR"
: "${CF_API_TOKEN:?}"
: "${CF_ZONE_ID:?}"
API="https://api.cloudflare.com/client/v4"

log_json(){ printf '%s\n' "$1" >> "$LOG"; }
is_provider_limit(){
  jq -e '.errors[]?.message | test("exceeded the maximum number of rules|not entitled")' >/dev/null 2>&1 <<<"$1"
}
defer_control(){
  local stage="$1" desc="$2" response="$3"
  local strict="${HARDENING_STRICT_PROVIDER_LIMITS:-0}"
  log_json "$(jq -nc --arg stage "$stage" --arg d "$desc" --argjson r "$response" '{stage:$stage,event:"control_deferred",description:$d,response:$r}')"
  jq -nc \
    --arg ts "$(date -u +%FT%TZ)" \
    --arg stage "$stage" \
    --arg d "$desc" \
    --argjson strict "$( [[ "$strict" == "1" ]] && echo true || echo false )" \
    --argjson r "$response" \
    '{ts:$ts,stage:$stage,event:"provider_limit_deferred",description:$d,strict:$strict,response:$r}' >> "$DEFERRED"
  if [[ "$strict" == "1" ]]; then
    return 1
  fi
  return 0
}
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
entry=""
rs_id=""
refresh_entry(){
  entry=$(req ratelimit GET "/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint")
  rs_id=$(echo "$entry" | jq -r '.result.id // empty')
}

refresh_entry
if [[ -z "$rs_id" ]]; then
  create=$(req ratelimit POST "/zones/$CF_ZONE_ID/rulesets" '{"name":"MJ MCP Rate Limit","kind":"zone","phase":"http_ratelimit","rules":[]}')
  rs_id=$(echo "$create" | jq -r '.result.id // empty')
  refresh_entry
fi
[[ -z "$rs_id" ]] && { echo "❌ unable to resolve ratelimit ruleset id"; exit 2; }

rl_failures=0
retired_descriptions=(
  "MCP-fleet :: /mcp soft cap"
  "MCP-fleet :: /turn/* hard cap"
)

for desc in "${retired_descriptions[@]}"; do
  existing=$(echo "$entry" | jq -c --arg d "$desc" '.result.rules[]? | select(.description==$d)' | head -n1)
  [[ -z "$existing" ]] && continue
  ex_id=$(echo "$existing" | jq -r '.id')
  echo "  [-] retiring legacy rate limit: $desc"
  result=$(req ratelimit DELETE "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules/$ex_id") || {
    echo "  ❌ Failed to retire legacy rate limit: $desc"
    log_json "$(jq -nc --arg d "$desc" '{stage:"ratelimit",event:"legacy_rule_delete_failed",description:$d}')"
    ((rl_failures++)) || true
    continue
  }
  ok=$(echo "$result" | jq -r '.success // false')
  if [[ "$ok" != "true" ]]; then
    echo "  ❌ API rejected legacy rate limit retirement: $desc"
    log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"ratelimit",event:"legacy_rule_delete_rejected",description:$d,response:$r}')"
    ((rl_failures++)) || true
  else
    refresh_entry
  fi
done

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
      if is_provider_limit "$result"; then
        echo "  ℹ️ provider limit deferred for rate limit: $desc"
        defer_control "ratelimit" "$desc" "$result" || ((rl_failures++)) || true
      else
        log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"ratelimit",event:"rule_create_rejected",description:$d,response:$r}')"
        ((rl_failures++)) || true
      fi
    else
      refresh_entry
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
      if is_provider_limit "$result"; then
        echo "  ℹ️ provider limit deferred for rate limit update: $desc"
        defer_control "ratelimit" "$desc" "$result" || ((rl_failures++)) || true
      else
        log_json "$(jq -nc --arg d "$desc" --argjson r "$result" '{stage:"ratelimit",event:"rule_update_rejected",description:$d,response:$r}')"
        ((rl_failures++)) || true
      fi
    else
      refresh_entry
    fi
  fi
done <<< "$rules"

if [[ $rl_failures -gt 0 ]]; then
  echo "⚠️ rate limit stage completed with $rl_failures failure(s)"
  exit 1
fi
echo "✅ rate limit stage complete"
