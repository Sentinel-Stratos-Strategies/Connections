#!/usr/bin/env bash
# 20-health-check.sh — verify all MCP hosts return 200 on /mcp
set -euo pipefail

ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"
OUT="$ART_DIR/health-$(date -u +%Y%m%dT%H%M%SZ).json"

HOSTS=(
  codex.your-domain.example
  cursor.your-domain.example
  gemini.your-domain.example
  antigravity.your-domain.example
  antigrativy.your-domain.example
)

results="[]"
for h in "${HOSTS[@]}"; do
  start=$(perl -MTime::HiRes=time -e 'printf "%.0f\n", time()*1000')
  resp=$(curl -sS -o /dev/null -D - -w "HTTP %{http_code}\n" \
    -X GET "https://$h/mcp" --max-time 10 2>&1 || true)
  end=$(perl -MTime::HiRes=time -e 'printf "%.0f\n", time()*1000')
  code=$(echo "$resp" | awk '/^HTTP/{print $2}' | tail -1)
  ray=$(echo "$resp" | awk -F': ' 'tolower($1)=="cf-ray"{print $2}' | tr -d '\r')
  server=$(echo "$resp" | awk -F': ' 'tolower($1)=="server"{print $2}' | tr -d '\r')
  latency=$((end - start))

  printf '  %s -> %s (%dms) ray=%s\n' "$h" "${code:-ERR}" "$latency" "${ray:-none}"

  results=$(jq --arg h "$h" --arg c "${code:-0}" --arg r "${ray:-}" --arg s "${server:-}" --argjson l "$latency" \
    '. + [{host:$h, code:($c|tonumber? // 0), latency_ms:$l, cf_ray:$r, server:$s}]' <<<"$results")
done

echo "$results" | jq '.' > "$OUT"
echo "✅ health: $OUT"

# fail-soft: report degraded hosts but don't exit non-zero
degraded=$(echo "$results" | jq -r '.[] | select(.code != 200) | .host')
if [[ -n "$degraded" ]]; then
  echo "⚠️  degraded:"
  echo "$degraded"
fi
