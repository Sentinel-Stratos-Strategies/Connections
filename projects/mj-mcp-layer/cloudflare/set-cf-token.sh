#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ missing $ENV_FILE"
  exit 1
fi

read -r -s -p "Enter CF_API_TOKEN: " token
echo
if [[ -z "$token" ]]; then
  echo "❌ empty token"
  exit 1
fi

tmp=$(mktemp)
awk -v t="$token" '
  BEGIN{updated=0}
  /^CF_API_TOKEN=/{print "CF_API_TOKEN=" t; updated=1; next}
  {print}
  END{if(updated==0) print "CF_API_TOKEN=" t}
' "$ENV_FILE" > "$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "✅ token set in $ENV_FILE"
