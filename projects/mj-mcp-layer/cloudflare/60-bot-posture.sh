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
expr=$(echo "$baseline_json" | jq -r '.bot_management.mcp_exemption.expression')
desc=$(echo "$baseline_json" | jq -r '.bot_management.mcp_exemption.description')

entry=$(req bot GET "/zones/$CF_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint")
rs_id=$(echo "$entry" | jq -r '.result.id // empty')
[[ -z "$rs_id" ]] && { echo "❌ missing firewall custom ruleset for bot exemption"; exit 2; }
existing=$(echo "$entry" | jq -c --arg d "$desc" '.result.rules[]? | select(.description==$d)' | head -n1)
payload=$(jq -nc --arg d "$desc" --arg e "$expr" '{description:$d,expression:$e,action:"skip",enabled:true,action_parameters:{phases:["http_request_firewall_managed"]}}')
want_fp=$(echo "$payload" | jq -c '{expression,action,enabled,action_parameters}' | sha256sum | cut -d' ' -f1)
bot_failures=0

if [[ -z "$existing" ]]; then
  echo "  [+] bot exemption"
  result=""
  result=$(req bot POST "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules" "$payload") || {
    echo "  ❌ Failed to create bot exemption"
    log_json "$(jq -nc '{stage:"bot",event:"rule_create_failed"}')"
    ((bot_failures++)) || true
  }
  if [[ -n "$result" ]]; then
    ok=$(echo "$result" | jq -r '.success // false')
    if [[ "$ok" != "true" ]]; then
      echo "  ❌ API rejected bot exemption"
      log_json "$(jq -nc --argjson r "$result" '{stage:"bot",event:"rule_create_rejected",response:$r}')"
      ((bot_failures++)) || true
    fi
  fi
else
  ex_id=$(echo "$existing" | jq -r '.id')
  existing_fp=$(echo "$existing" | jq -c '{expression,action,enabled,action_parameters}' | sha256sum | cut -d' ' -f1)
  if [[ "$want_fp" != "$existing_fp" ]]; then
    echo "  [~] bot exemption"
    result=""
    result=$(req bot PATCH "/zones/$CF_ZONE_ID/rulesets/$rs_id/rules/$ex_id" "$payload") || {
      echo "  ❌ Failed to update bot exemption"
      log_json "$(jq -nc '{stage:"bot",event:"rule_update_failed"}')"
      ((bot_failures++)) || true
    }
    if [[ -n "$result" ]]; then
      ok=$(echo "$result" | jq -r '.success // false')
      if [[ "$ok" != "true" ]]; then
        echo "  ❌ API rejected bot exemption update"
        log_json "$(jq -nc --argjson r "$result" '{stage:"bot",event:"rule_update_rejected",response:$r}')"
        ((bot_failures++)) || true
      fi
    fi
  else
    echo "  [=] bot exemption (no changes, skipping)"
  fi
fi

echo "ℹ️ note: zone-level Super Bot Fight Mode tuning must be validated against plan support"
if [[ $bot_failures -gt 0 ]]; then
  echo "⚠️ bot posture stage completed with $bot_failures failure(s)"
  exit 1
fi
echo "✅ bot posture stage complete"
