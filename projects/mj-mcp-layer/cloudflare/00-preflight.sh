#!/usr/bin/env bash
# 00-preflight.sh — verify auth + zone access before any mutation
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"

ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"

LOG() { printf '{"ts":"%s","stage":"preflight","msg":"%s"}\n' "$(date -u +%FT%TZ)" "$1" >> "$ART_DIR/run-log.jsonl"; }

: "${CF_API_TOKEN:?CF_API_TOKEN env var required}"
: "${CF_ZONE_ID:?CF_ZONE_ID env var required}"

echo "==> wrangler whoami"
if ! wrangler whoami >/dev/null 2>&1; then
  echo "WARN: wrangler not authed — falling back to raw API only"
  LOG "wrangler_whoami_failed"
fi

echo "==> verifying CF zone access"
RESP=$(curl -sS -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID")

OK=$(echo "$RESP" | jq -r '.success')
NAME=$(echo "$RESP" | jq -r '.result.name // "unknown"')

if [[ "$OK" != "true" ]]; then
  echo "$RESP" > "$ART_DIR/preflight-FAIL.json"
  LOG "zone_access_failed"
  echo "❌ Zone access failed. See $ART_DIR/preflight-FAIL.json"
  exit 2
fi

echo "✅ zone: $NAME"
LOG "preflight_ok zone=$NAME"
