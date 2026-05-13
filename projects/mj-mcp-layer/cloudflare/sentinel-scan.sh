#!/usr/bin/env bash
# sentinel-scan.sh — drift detection for ellis-aegis.us
# Compares current Cloudflare state against Codex ledger + baseline.
# Anything not authored by Codex is flagged as unauthorized.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./load-cf-env.sh
source "$SCRIPT_DIR/load-cf-env.sh"

ART_DIR="${ART_DIR:-./artifacts}"
LEDGER="${LEDGER:-$ART_DIR/codex-ledger.jsonl}"
BASELINE="${BASELINE:-$SCRIPT_DIR/security-baseline.yaml}"
mkdir -p "$ART_DIR"

TS=$(date -u +%Y%m%dT%H%M%SZ)
SCAN="$ART_DIR/scan-$TS.json"
DRIFT="$ART_DIR/drift-$TS.md"
ALERT="$ART_DIR/ALERT-$TS.md"

: "${CF_API_TOKEN:?CF_API_TOKEN required}"
: "${CF_ZONE_ID:?CF_ZONE_ID required}"

API="https://api.cloudflare.com/client/v4"
H=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")

echo "🛡️  SENTINEL SCAN — $TS"
echo "    zone: $CF_ZONE_ID"
echo

# ---------- collect current state ----------
echo "==> [1/10] DNS records"
DNS=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/dns_records?per_page=500")

echo "==> [2/10] WAF custom rules"
WAF=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint" || echo '{}')

echo "==> [3/10] Rate limit rules"
RL=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" || echo '{}')

echo "==> [4/10] Cache rules"
CACHE=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" || echo '{}')

echo "==> [5/10] Page rules"
PAGE=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/pagerules" || echo '{}')

echo "==> [6/10] SSL settings"
SSL=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/settings/ssl" || echo '{}')

echo "==> [7/10] Security level"
SEC=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/settings/security_level" || echo '{}')

echo "==> [8/10] Bot management"
BOT=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/bot_management" || echo '{}')

echo "==> [9/10] Worker routes"
WR=$(curl -sS "${H[@]}" "$API/zones/$CF_ZONE_ID/workers/routes" || echo '{}')

echo "==> [10/10] Recent audit log (last 6h)"
SINCE=$(date -u -v-6H +%FT%TZ 2>/dev/null || date -u -d '6 hours ago' +%FT%TZ)
ACCT_ID="${CF_ACCOUNT_ID:-}"
if [[ -n "$ACCT_ID" ]]; then
  AUDIT=$(curl -sS "${H[@]}" "$API/accounts/$ACCT_ID/audit_logs?since=$SINCE&per_page=200" || echo '{}')
else
  AUDIT='{"note":"CF_ACCOUNT_ID not set; skipping audit log"}'
fi

# ---------- consolidate ----------
jq -n \
  --argjson dns "$DNS" --argjson waf "$WAF" --argjson rl "$RL" \
  --argjson cache "$CACHE" --argjson page "$PAGE" --argjson ssl "$SSL" \
  --argjson sec "$SEC" --argjson bot "$BOT" --argjson wr "$WR" --argjson audit "$AUDIT" \
  --arg ts "$TS" \
  '{scan_ts:$ts, dns:$dns, waf:$waf, ratelimit:$rl, cache:$cache, pagerules:$page,
    ssl:$ssl, security_level:$sec, bot_management:$bot, worker_routes:$wr, audit:$audit}' \
  > "$SCAN"

echo "✅ scan written: $SCAN"

BASELINE_WAF_DESCRIPTIONS=$(
  node -e "const fs=require('fs');const YAML=require('yaml');const p=YAML.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify((p.waf_rules ?? []).map((rule) => rule.description).filter(Boolean)));" "$BASELINE"
)

# Hard-fail on Cloudflare API auth/rate-limit errors so we never report false-clean drift.
API_ERRORS=$(jq -r '
  [
    .dns, .waf, .ratelimit, .cache, .pagerules, .ssl, .security_level, .bot_management, .worker_routes
  ]
  | map(select(.success != true))
  | length
' "$SCAN")
if [[ "${API_ERRORS:-0}" -gt 0 ]]; then
  {
    echo "# Drift Report — $TS"
    echo
    echo "Zone: \`$CF_ZONE_ID\`"
    echo
    echo "## ❌ SCAN INVALID"
    echo "- Cloudflare API returned errors for one or more checks."
    echo "- This run cannot assert drift status."
    echo
    echo "## API Error Summary"
    jq -r '
      {
        dns: .dns.errors,
        waf: .waf.errors,
        ratelimit: .ratelimit.errors,
        cache: .cache.errors,
        pagerules: .pagerules.errors,
        ssl: .ssl.errors,
        security_level: .security_level.errors,
        bot_management: .bot_management.errors,
        worker_routes: .worker_routes.errors
      } | to_entries[] | select(.value and (.value|length>0)) | "- " + .key + ": " + (.value|tostring)
    ' "$SCAN"
  } > "$DRIFT"
  cp "$DRIFT" "$ALERT"
  echo "🚨 scan invalid due to API errors. ALERT FILE: $ALERT"
  exit 9
fi

# ---------- drift analysis ----------
DRIFT_FOUND=0
{
  echo "# Drift Report — $TS"
  echo
  echo "Zone: \`$CF_ZONE_ID\`"
  echo

  # 1. DNS records vs ledger
  echo "## DNS records"
  DNS_COUNT=$(echo "$DNS" | jq '.result | length')
  echo "- current count: $DNS_COUNT"
  if [[ -f "$LEDGER" ]]; then
    KNOWN=$(grep -c '"intent":"dns_record_create"' "$LEDGER" 2>/dev/null || echo 0)
    echo "- codex-authored: $KNOWN"
    if [[ "$DNS_COUNT" -gt "$KNOWN" ]]; then
      echo "- ⚠️  POTENTIAL UNAUTHORIZED RECORDS: $((DNS_COUNT - KNOWN))"
      DRIFT_FOUND=1

      # list records not in ledger
      echo "$DNS" | jq -r '.result[] | "\(.type) \(.name) \(.content)"' | while read -r line; do
        if ! grep -qF "$line" "$LEDGER" 2>/dev/null; then
          echo "  - 🚨 not in ledger: \`$line\`"
        fi
      done
    fi
  else
    echo "- ⚠️  no ledger found at $LEDGER (first run? bootstrap required)"
  fi
  echo

  # 2. WAF rules vs baseline
  echo "## WAF custom rules"
  WAF_RULES=$(echo "$WAF" | jq -r '.result.rules // [] | length')
  BASE_RULES=$(echo "$BASELINE_WAF_DESCRIPTIONS" | jq 'length')
  echo "- in zone: $WAF_RULES"
  echo "- in baseline: $BASE_RULES"
  if [[ "$WAF_RULES" -ne "$BASE_RULES" ]]; then
    echo "- ⚠️  count mismatch"
    DRIFT_FOUND=1
  fi
  # check each baseline rule exists by description
  while IFS= read -r DESC; do
    [[ -z "$DESC" ]] && continue
    MATCH=$(echo "$WAF" | jq --arg d "$DESC" '[.result.rules[]? | select(.description == $d)] | length')
    if [[ "$MATCH" == "0" ]]; then
      echo "  - 🚨 MISSING from zone: $DESC"
      DRIFT_FOUND=1
    fi
  done < <(echo "$BASELINE_WAF_DESCRIPTIONS" | jq -r '.[]')

  # check for rules in zone not in baseline
  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    FOUND=$(echo "$BASELINE_WAF_DESCRIPTIONS" | jq --arg d "$d" 'index($d) != null')
    if [[ "$FOUND" != "true" ]]; then
      echo "  - 🚨 IN ZONE BUT NOT IN BASELINE: $d"
      DRIFT_FOUND=1
    fi
  done < <(echo "$WAF" | jq -r '.result.rules[]?.description')
  echo

  # 3. Recent audit log changes not by Codex
  echo "## Recent zone changes (last 6h)"
  if [[ -n "$ACCT_ID" ]]; then
    CHANGES=$(echo "$AUDIT" | jq -r '.result // [] | length')
    echo "- entries: $CHANGES"
    echo "$AUDIT" | jq -r '.result[]? | "  - [\(.when)] \(.actor.email // "system") :: \(.action.type) :: \(.resource.type)"' || true
    # any actor that isn't the Codex automation token email is suspicious
    OTHER=$(echo "$AUDIT" | jq -r '[.result[]? | select(.actor.email != "'"${CODEX_ACTOR_EMAIL:-codex@ellis-aegis.us}"'")] | length')
    if [[ "$OTHER" -gt 0 ]]; then
      echo "- 🚨 $OTHER changes by non-Codex actors"
      DRIFT_FOUND=1
    fi
  else
    echo "- (skipped — set CF_ACCOUNT_ID to enable audit log scan)"
  fi
  echo

  # 4. SSL posture
  echo "## SSL / TLS"
  echo "- mode: $(echo "$SSL" | jq -r '.result.value // "unknown"')"
  echo "- security level: $(echo "$SEC" | jq -r '.result.value // "unknown"')"
  echo

  # 5. Worker routes
  echo "## Worker routes"
  echo "$WR" | jq -r '.result[]? | "  - \(.pattern) → \(.script)"' || echo "  (none)"
  echo

  # summary
  echo "---"
  if [[ "$DRIFT_FOUND" -eq 1 ]]; then
    echo "## ❌ DRIFT DETECTED — escalate to operator"
  else
    echo "## ✅ no drift detected"
  fi
} > "$DRIFT"

echo
cat "$DRIFT"

if [[ "$DRIFT_FOUND" -eq 1 ]]; then
  cp "$DRIFT" "$ALERT"
  echo
  echo "🚨 ALERT FILE: $ALERT"
  exit 7   # distinct exit code for drift
fi
