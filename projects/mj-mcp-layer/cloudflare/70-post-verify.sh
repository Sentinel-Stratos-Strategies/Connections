#!/usr/bin/env bash
set -euo pipefail
ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"

./scripts/10-inventory-cf.sh after
./scripts/20-health-check.sh

jq -n \
  --slurpfile b "$ART_DIR/inventory-before.json" \
  --slurpfile a "$ART_DIR/inventory-after.json" \
  '{before:$b[0], after:$a[0]}' > "$ART_DIR/inventory-joined.json"

jq -r '
"# Inventory Diff", "", 
"## WAF", ("- before: " + ((.before.waf.result.rules|length|tostring) // "0")), ("- after: " + ((.after.waf.result.rules|length|tostring) // "0")),"",
"## Rate Limits", ("- before: " + ((.before.ratelimit.result.rules|length|tostring) // "0")), ("- after: " + ((.after.ratelimit.result.rules|length|tostring) // "0")),"",
"## Cache", ("- before: " + ((.before.cache.result.rules|length|tostring) // "0")), ("- after: " + ((.after.cache.result.rules|length|tostring) // "0"))
' "$ART_DIR/inventory-joined.json" > "$ART_DIR/diff.md"

if npm run memory:supabase:sync:audit >/dev/null 2>&1; then
  echo "✅ supabase smoke script executed" | tee "$ART_DIR/supabase-smoke.txt"
else
  echo "⚠️ supabase smoke script failed" | tee "$ART_DIR/supabase-smoke.txt"
fi

echo "✅ post-verify complete"
