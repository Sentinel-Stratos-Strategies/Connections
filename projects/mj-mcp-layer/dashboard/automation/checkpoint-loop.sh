#!/usr/bin/env bash
# Optional: run checkpoint.sh every INTERVAL seconds with auto-push (trusted branch only).
# Roadmap: ../CHECKPOINTS.md — set CHECKPOINT=n in the message you pass, or export CHECKPOINT before starting.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
while true; do
  sleep "${CHECKPOINT_INTERVAL_SECS:-600}"
  CHECKPOINT_AUTO_PUSH=1 bash "$DIR/checkpoint.sh" "${1:-chore(mj-edge): timed checkpoint}"
done
