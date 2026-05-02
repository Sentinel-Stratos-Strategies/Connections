#!/usr/bin/env bash
# install-cron.sh — register the recurring sentinel scan
# Runs every 6 hours. Logs to artifacts/cron.log.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LINE="0 */6 * * * cd $REPO_DIR && ./scripts/sentinel-scan.sh >> $REPO_DIR/artifacts/cron.log 2>&1"

# don't duplicate
if crontab -l 2>/dev/null | grep -qF "sentinel-scan.sh"; then
  echo "✅ cron already installed"
  crontab -l | grep sentinel-scan.sh
  exit 0
fi

(crontab -l 2>/dev/null; echo "$LINE") | crontab -
echo "✅ installed: $LINE"
echo
echo "to remove:  crontab -e   then delete the sentinel-scan.sh line"
echo "to test now: ./scripts/sentinel-scan.sh"
