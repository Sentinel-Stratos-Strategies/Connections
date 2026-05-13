#!/bin/zsh
# mj-local-models-bridge startup script
# Run this to bring the lane online. Ollama must already be running.

set -euo pipefail

OLLAMA_BIN="/Volumes/Stratos_Tools/homebrew/bin/ollama"
NODE_BIN="/Volumes/Stratos_Tools/homebrew/bin/node"
BRIDGE_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_SRC="$BRIDGE_DIR/src/local-models-bridge.ts"
OLLAMA_MODELS="/Volumes/Stratos_Tools/models"
LOG_DIR="/Volumes/SENTINEL/Logs/local-models-bridge"

mkdir -p "$LOG_DIR"

echo "── mj-local-models-bridge startup ──"

# 1. Check Ollama is alive
if ! curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
  echo "[start] Ollama not running — launching..."
  OLLAMA_MODELS="$OLLAMA_MODELS" "$OLLAMA_BIN" serve > "$LOG_DIR/ollama.log" 2>&1 &
  sleep 4
fi

# 2. Pull any missing models (no-op if already present)
REQUIRED_MODELS=("qwen3:latest" "mistral-nemo:latest" "gemma3:4b")
for model in "${REQUIRED_MODELS[@]}"; do
  if ! OLLAMA_MODELS="$OLLAMA_MODELS" "$OLLAMA_BIN" list 2>/dev/null | grep -q "${model%%:*}"; then
    echo "[start] Pulling $model..."
    OLLAMA_MODELS="$OLLAMA_MODELS" "$OLLAMA_BIN" pull "$model"
  else
    echo "[start] $model OK"
  fi
done

# 3. Install ts-node if needed
if ! command -v ts-node &>/dev/null && ! "$NODE_BIN" -e "require('ts-node')" 2>/dev/null; then
  echo "[start] Installing ts-node..."
  npm install -g ts-node typescript 2>/dev/null || true
fi

# 4. Start bridge
echo "[start] Starting bridge on :11437..."
OLLAMA_MODELS="$OLLAMA_MODELS" npx ts-node "$BRIDGE_SRC" 2>&1 | tee -a "$LOG_DIR/bridge-$(date +%Y%m%d).log"
