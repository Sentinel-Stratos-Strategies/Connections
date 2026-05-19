#!/usr/bin/env bash
set -euo pipefail
ART_DIR="${ART_DIR:-./artifacts}"
OUT="$ART_DIR/security-baseline-sheet.md"
LOG="$ART_DIR/run-log.jsonl"
AFTER="$ART_DIR/inventory-after.json"

jq -r '
"# Security Baseline Sheet", "",
"Generated: " + (now | todate), "",
"## WAF Rules", (.waf.result.rules[]? | "- id=`" + .id + "` | " + .description + " | action=`" + .action + "`"), "",
"## Rate Limit Rules", (.ratelimit.result.rules[]? | "- id=`" + .id + "` | " + .description + " | action=`" + .action + "`"), "",
"## Cache Rules", (.cache.result.rules[]? | "- id=`" + .id + "` | " + .description + " | action=`" + .action + "`"), "",
"## Rollback", "- Delete rule: curl -X DELETE https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rulesets/<RULESET_ID>/rules/<RULE_ID>", "",
"## Last API Calls", "```jsonl"
' "$AFTER" > "$OUT"

tail -n 20 "$LOG" >> "$OUT" 2>/dev/null || true
echo '```' >> "$OUT"

echo "✅ baseline sheet: $OUT"
