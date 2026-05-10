#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
cd "$PROJECT_DIR"
ART_DIR="${ART_DIR:-$PROJECT_DIR/artifacts}"
export ART_DIR
export BASELINE="${BASELINE:-$SCRIPT_DIR/security-baseline.yaml}"
mkdir -p "$ART_DIR"

run_stage() {
  local name="$1" cmd="$2"
  local ts
  ts="$(date -u +%FT%TZ)"
  echo "==> [$ts] $name"
  set +e
  bash -lc "$cmd"
  local rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "⚠️ $name failed rc=$rc" | tee -a "$ART_DIR/stage-failures.log"
    printf '{"ts":"%s","stage":"%s","rc":%d}\n' "$ts" "$name" "$rc" >> "$ART_DIR/run-log.jsonl"
  fi
  return 0
}

echo "===> backing up current state before mutations"
if [[ -f "$ART_DIR/inventory-before.json" ]]; then
  cp "$ART_DIR/inventory-before.json" "$ART_DIR/inventory-backup-$(date +%s).json"
fi

check_rotation_status() {
  local baseline="$1"
  local failures=0
  while read -r rotation_date; do
    [[ -z "$rotation_date" ]] && continue
    local now_epoch rotation_epoch days_old
    now_epoch=$(date +%s)
    rotation_epoch=$(date -d "$rotation_date" +%s 2>/dev/null || echo 0)
    if [[ "$rotation_epoch" -eq 0 ]]; then
      continue
    fi
    days_old=$(( (now_epoch - rotation_epoch) / 86400 ))
    if [[ $days_old -gt 30 ]]; then
      echo "⚠️ ALERT: Secret rotation overdue by $days_old days (rotated: $rotation_date)"
      ((failures++)) || true
    fi
  done < <(node -e "const fs=require('fs');const YAML=require('yaml');const p=YAML.parse(fs.readFileSync(process.argv[1],'utf8'));for (const item of p.rotation_log ?? []) if (item.status === 'NEEDS_ROTATION') console.log(item.date);" "$baseline")
  return "${failures:-0}"
}

run_rotation_stage() {
  local name="K rotation check"
  local ts rc
  ts="$(date -u +%FT%TZ)"
  echo "==> [$ts] $name"
  set +e
  check_rotation_status "$BASELINE"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "⚠️ $name failed rc=$rc" | tee -a "$ART_DIR/stage-failures.log"
    printf '{"ts":"%s","stage":"%s","rc":%d}\n' "$ts" "$name" "$rc" >> "$ART_DIR/run-log.jsonl"
  fi
  return 0
}

run_stage "A preflight"         "bash $SCRIPT_DIR/00-preflight.sh"
run_stage "A inventory before"  "bash $SCRIPT_DIR/10-inventory-cf.sh before"
run_stage "B health snapshot"   "bash $SCRIPT_DIR/20-health-check.sh"
run_stage "C apply waf"         "bash $SCRIPT_DIR/30-apply-waf.sh"
run_stage "D apply rate limits" "bash $SCRIPT_DIR/40-apply-ratelimit.sh"
run_stage "E apply cache"       "bash $SCRIPT_DIR/50-apply-cache.sh"
run_stage "F bot posture"       "bash $SCRIPT_DIR/60-bot-posture.sh"
run_stage "G post verify"       "bash $SCRIPT_DIR/70-post-verify.sh"
run_stage "H baseline sheet"    "bash $SCRIPT_DIR/80-generate-baseline-sheet.sh"
run_stage "I runbooks + summary" "bash $SCRIPT_DIR/90-generate-runbooks.sh"
run_rotation_stage

echo "✅ automation run complete"
echo "Artifacts: $ART_DIR"
