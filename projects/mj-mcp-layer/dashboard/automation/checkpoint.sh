#!/usr/bin/env bash
# MJ Edge checkpoint runner: sync dashboard → validate → optional auto-push.
#
# Numbered roadmap: ../../CHECKPOINTS.md (CP-1 … CP-10). Tag commits with CP-n when you finish a step, e.g.
#   CHECKPOINT_AUTO_PUSH=1 CHECKPOINT=3 ./checkpoint.sh "feat(mj-edge): pin lucide (CP-3)"
#
# Usage:
#   ./checkpoint.sh              # validate only
#   CHECKPOINT_AUTO_PUSH=1 ./checkpoint.sh "commit message"   # commit + push
# Ten-minute gate (CLI buddy): run checkpoint-loop.sh or:
#   sleep 600 && CHECKPOINT_AUTO_PUSH=1 ./checkpoint.sh "chore: advance checkpoint"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MJ_LAYER_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$MJ_LAYER_ROOT/../.." && pwd)"
cd "$MJ_LAYER_ROOT"

if [[ -n "${CHECKPOINT:-}" ]]; then
  echo "==> CP-${CHECKPOINT} — see dashboard/CHECKPOINTS.md"
fi

bash "$SCRIPT_DIR/sync-public.sh"

echo "==> mj-mcp-layer tests + typecheck"
npm test
npm run check

echo "==> wrangler dry-run"
npm --prefix mcp-layer run typecheck
npm --prefix mcp-layer test
(cd mcp-layer && npx wrangler deploy --dry-run)

if [[ "${CHECKPOINT_AUTO_PUSH:-0}" == "1" ]]; then
  MSG="${1:-chore(mj-edge): checkpoint advance}"
  cd "$REPO_ROOT"
  git add \
    projects/mj-mcp-layer/dashboard \
    projects/mj-mcp-layer/mcp-layer/public \
    projects/mj-mcp-layer/mcp-layer/src \
    projects/mj-mcp-layer/mcp-layer/wrangler.jsonc \
    projects/mj-mcp-layer/mcp-layer/tests
  if git diff --cached --quiet; then
    echo "Nothing to commit."
  else
    git commit -m "$MSG"
    git push
  fi
fi

echo "==> checkpoint OK"
