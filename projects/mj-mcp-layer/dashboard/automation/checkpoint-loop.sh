#!/usr/bin/env bash
# Optional: run checkpoint.sh every 10 minutes with auto-push (use only on a trusted branch).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
while true; do
  sleep "${CHECKPOINT_INTERVAL_SECS:-600}"
  CHECKPOINT_AUTO_PUSH=1 bash "$DIR/checkpoint.sh" "${1:-chore(mj-edge): timed checkpoint}"
done
