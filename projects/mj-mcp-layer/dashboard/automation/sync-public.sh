#!/usr/bin/env bash
# Sync canonical dashboard HTML into Worker static bundle (checkpoint hygiene).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/dashboard/mj-edge-v2.html"
DEST_DIR="$ROOT/mcp-layer/public/dashboard"
mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_DIR/index.html"
rm -rf "$DEST_DIR/vendor"
cp -R "$ROOT/dashboard/vendor" "$DEST_DIR/vendor"
echo "synced $SRC + vendor/ -> $DEST_DIR/"
