#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"

bash "$SCRIPT_DIR/10-inventory-cf.sh" after
bash "$SCRIPT_DIR/20-health-check.sh"

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

echo "ℹ️ application smoke tests are handled by CI/package typechecks" | tee "$ART_DIR/app-smoke.txt"

echo "✅ post-verify complete"
