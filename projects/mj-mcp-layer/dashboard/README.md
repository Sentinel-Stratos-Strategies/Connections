# MJ Edge dashboard (static)

## List entry — design source

| Artifact | Path |
|----------|------|
| Authoritative export (local) | `/Users/home/Downloads/mj-edge-v2.html` |
| Repo snapshot (this branch) | `projects/mj-mcp-layer/dashboard/mj-edge-v2.html` |

This matches the MJ MCP 10/10 handoff allowlist path `projects/mj-mcp-layer/dashboard/**/*`.

## Checkpoints

Numbered roadmap (**CP-1 … CP-10**), statuses, and commit convention: **[CHECKPOINTS.md](./CHECKPOINTS.md)**.

## Scope

- **Static prototype** for behavior: Admin / Customer tabs, command palette, demo metrics, client-side toasts.
- **Served in prod** at `GET /dashboard` on the Worker (static bundle); interactive actions are still **not** backed by APIs except what you add in later checkpoints.
- **CP-3:** Lucide **0.469.0** + variable Inter / Space Grotesk (latin `.woff2` pinned under `dashboard/vendor/fonts/`). No runtime third-party origins — Lucide **SRI**, matching **CSP** (`meta` + Worker `Content-Security-Policy` on dashboard HTML). See `vendor/README.md`.

## Local preview

```bash
cd projects/mj-mcp-layer/dashboard
python3 -m http.server 8765
# open http://127.0.0.1:8765/mj-edge-v2.html
```

## Deployed Worker route

After deploy, the same UI is served at **`GET /dashboard`** (maps to `mcp-layer/public/dashboard/index.html` via Wrangler `assets` + `ASSETS` binding). Without the binding (e.g. some tests), the Worker returns **503** with a plain-text reason.

Sync canonical HTML into the Worker bundle before PR/deploy:

```bash
bash projects/mj-mcp-layer/dashboard/automation/sync-public.sh
```

## CLI checkpoint automation

```bash
bash projects/mj-mcp-layer/dashboard/automation/checkpoint.sh
```

Auto-commit + push only when you opt in (never runs `git add -A`):

```bash
CHECKPOINT_AUTO_PUSH=1 bash projects/mj-mcp-layer/dashboard/automation/checkpoint.sh "feat(mj-edge): your message"
```

Optional **10-minute cadence** (your shell, not background agent sleep):

```bash
while true; do sleep 600; CHECKPOINT_AUTO_PUSH=1 bash projects/mj-mcp-layer/dashboard/automation/checkpoint.sh "chore(mj-edge): timed checkpoint"; done
```

## Review branch

Disposable branch `review/mj-edge-v2-ui-only`: add or drop without merging if you want zero footprint on `MJ_Layer`.
