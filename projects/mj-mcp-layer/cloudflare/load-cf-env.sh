#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load .env files if present
set -a
[[ -f "$ROOT_DIR/.env" ]] && source "$ROOT_DIR/.env"
[[ -f "$ROOT_DIR/.env.local" ]] && source "$ROOT_DIR/.env.local"
set +a

# Accept either naming convention
if [[ -z "${CF_API_TOKEN:-}" && -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  export CF_API_TOKEN="$CLOUDFLARE_API_TOKEN"
fi
if [[ -z "${CF_ZONE_ID:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
  export CF_ZONE_ID="$CLOUDFLARE_ZONE_ID"
fi

# Optional fallback from wrangler oauth token if present and unexpired.
if [[ -z "${CF_API_TOKEN:-}" ]]; then
  WRANGLER_CFG=""
  if [[ -f "${HOME}/Library/Preferences/.wrangler/config/default.toml" ]]; then
    WRANGLER_CFG="${HOME}/Library/Preferences/.wrangler/config/default.toml"
  elif [[ -f "${HOME}/.config/.wrangler/config/default.toml" ]]; then
    WRANGLER_CFG="${HOME}/.config/.wrangler/config/default.toml"
  fi
  if [[ -n "$WRANGLER_CFG" && -f "$WRANGLER_CFG" ]]; then
    token=$(sed -n 's/^oauth_token = "\(.*\)"/\1/p' "$WRANGLER_CFG" | head -n1 || true)
    expiry=$(sed -n 's/^expiration_time = "\(.*\)"/\1/p' "$WRANGLER_CFG" | head -n1 || true)
    if [[ -n "$token" && -n "$expiry" ]]; then
      now_epoch=$(date -u +%s)
      # Try GNU date first, fall back to BSD date
      exp_epoch=$(date -u -d "${expiry%.*}" +%s 2>/dev/null \
        || date -u -j -f "%Y-%m-%dT%H:%M:%S" "${expiry%.*}" +%s 2>/dev/null \
        || echo 0)
      if [[ "$exp_epoch" -gt "$now_epoch" ]]; then
        export CF_API_TOKEN="$token"
      fi
    fi
  fi
fi
