#!/usr/bin/env bash
# 20-health-check.sh — verify all MCP hosts return 200 on a policy-declared health path
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASELINE="${BASELINE:-$SCRIPT_DIR/security-baseline.yaml}"
ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"
OUT="$ART_DIR/health-$(date -u +%Y%m%dT%H%M%SZ).json"
DEFERRED="$ART_DIR/control-deferrals.jsonl"
HEALTH_PATH="${HEALTH_PATH:-/healthz}"
HEALTH_STRICT="${HEALTH_STRICT:-0}"
HEALTH_TENANT_ID="${HEALTH_TENANT_ID:-health-check}"
HEALTH_POLICY_VERSION="${HEALTH_POLICY_VERSION:-mj-edge-unified-v2}"
HEALTH_CAPABILITY="${HEALTH_CAPABILITY:-mcp.admin}"

if [[ -n "${HEALTH_HOSTS:-}" ]]; then
  IFS=', ' read -r -a HOSTS <<< "$HEALTH_HOSTS"
else
  HOSTS=()
  while IFS= read -r host; do
    [[ -n "$host" ]] && HOSTS+=("$host")
  done < <(node -e "const fs=require('fs');const YAML=require('yaml');const p=YAML.parse(fs.readFileSync(process.argv[1],'utf8'));for (const item of p.hosts ?? []) if (item.host) console.log(item.host);" "$BASELINE")
fi

if [[ "${#HOSTS[@]}" -eq 0 ]]; then
  echo "❌ no health hosts configured; set HEALTH_HOSTS or define hosts in $BASELINE"
  exit 2
fi

results="[]"
for h in "${HOSTS[@]}"; do
  [[ -z "$h" ]] && continue
  request_headers=()
  if [[ "$HEALTH_PATH" == "/mcp" ]]; then
    request_headers=(
      -H "x-tenant-id: $HEALTH_TENANT_ID"
      -H "x-request-id: health-$(date -u +%Y%m%dT%H%M%SZ)"
      -H "x-policy-version: $HEALTH_POLICY_VERSION"
      -H "x-operator-capability: $HEALTH_CAPABILITY"
    )
    if [[ -n "${MCP_HEALTH_TOKEN:-}" ]]; then
      request_headers+=(-H "Authorization: Bearer $MCP_HEALTH_TOKEN")
    fi
  fi

  start=$(perl -MTime::HiRes=time -e 'printf "%.0f\n", time()*1000')
  if [[ "${#request_headers[@]}" -gt 0 ]]; then
    resp=$(curl -sS -o /dev/null -D - -w "HTTP %{http_code}\n" \
      "${request_headers[@]}" \
      -X GET "https://$h$HEALTH_PATH" --max-time 10 2>&1 || true)
  else
    resp=$(curl -sS -o /dev/null -D - -w "HTTP %{http_code}\n" \
      -X GET "https://$h$HEALTH_PATH" --max-time 10 2>&1 || true)
  fi
  end=$(perl -MTime::HiRes=time -e 'printf "%.0f\n", time()*1000')
  code=$(echo "$resp" | awk '/^HTTP/{print $2}' | tail -1)
  ray=$(echo "$resp" | awk -F': ' 'tolower($1)=="cf-ray"{print $2}' | tr -d '\r')
  server=$(echo "$resp" | awk -F': ' 'tolower($1)=="server"{print $2}' | tr -d '\r')
  latency=$((end - start))

  printf '  %s%s -> %s (%dms) ray=%s\n' "$h" "$HEALTH_PATH" "${code:-ERR}" "$latency" "${ray:-none}"

  results=$(jq --arg h "$h" --arg c "${code:-0}" --arg r "${ray:-}" --arg s "${server:-}" --argjson l "$latency" \
    '. + [{host:$h, code:($c|tonumber? // 0), latency_ms:$l, cf_ray:$r, server:$s}]' <<<"$results")
done

echo "$results" | jq '.' > "$OUT"
echo "✅ health: $OUT"

degraded=$(echo "$results" | jq -r '.[] | select(.code != 200) | .host')
if [[ -n "$degraded" ]]; then
  echo "⚠️  degraded:"
  echo "$degraded"
  jq -nc \
    --arg ts "$(date -u +%FT%TZ)" \
    --arg path "$HEALTH_PATH" \
    --argjson strict "$( [[ "$HEALTH_STRICT" == "1" ]] && echo true || echo false )" \
    --argjson results "$results" \
    '{ts:$ts,stage:"health",event:"degraded_hosts",path:$path,strict:$strict,results:$results}' >> "$DEFERRED"
  if [[ "$HEALTH_STRICT" == "1" ]]; then
    exit 1
  fi
  echo "ℹ️ health degradation recorded as advisory; set HEALTH_STRICT=1 to fail this stage"
fi
