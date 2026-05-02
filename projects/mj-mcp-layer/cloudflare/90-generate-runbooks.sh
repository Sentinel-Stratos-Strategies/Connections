#!/usr/bin/env bash
set -euo pipefail
ART_DIR="${ART_DIR:-./artifacts}"
mkdir -p "$ART_DIR"

cat > "$ART_DIR/SECRET-ROTATION-RUNBOOK.md" <<'MD'
# Secret Rotation Runbook

1. Rotate Supabase service role key in Supabase Dashboard (`Settings -> API -> Reset service_role`).
2. Update Cloudflare worker secret:
   - `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
3. Re-run smoke test:
   - `npm run memory:supabase:sync:audit`
4. Verify old key now fails (401) against Supabase API.
5. Update `docs/security-baseline.yaml` rotation log with date, operator, and ticket.
MD

cat > "$ART_DIR/SUMMARY.md" <<MD
# Automation Summary

Status timestamp: $(date -u +%FT%TZ)

- Preflight: see 
  - artifacts/run-log.jsonl
- Inventory before/after:
  - artifacts/inventory-before.json
  - artifacts/inventory-after.json
- Diff:
  - artifacts/diff.md
- Baseline sheet:
  - artifacts/security-baseline-sheet.md
- Rotation runbook:
  - artifacts/SECRET-ROTATION-RUNBOOK.md
MD

echo "✅ runbooks generated"
