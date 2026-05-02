#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"

run_stage() {
  local name="$1" cmd="$2"
  echo "==> $name"
  set +e
  bash -lc "$cmd"
  local rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "⚠️ $name failed rc=$rc" | tee -a "$ART_DIR/stage-failures.log"
  fi
  return 0
}

run_stage "A preflight" "./scripts/00-preflight.sh"
run_stage "A inventory before" "./scripts/10-inventory-cf.sh before"
run_stage "B health snapshot" "./scripts/20-health-check.sh"
run_stage "C apply waf" "./scripts/30-apply-waf.sh"
run_stage "D apply rate limits" "./scripts/40-apply-ratelimit.sh"
run_stage "E apply cache" "./scripts/50-apply-cache.sh"
run_stage "F bot posture" "./scripts/60-bot-posture.sh"
run_stage "G post verify" "./scripts/70-post-verify.sh"
run_stage "H baseline sheet" "./scripts/80-generate-baseline-sheet.sh"
run_stage "I runbooks + summary" "./scripts/90-generate-runbooks.sh"

echo "✅ automation run complete"
echo "Artifacts: $ART_DIR"
