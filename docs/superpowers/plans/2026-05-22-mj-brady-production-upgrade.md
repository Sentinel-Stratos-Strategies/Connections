# MJ Brady Production Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete MJ Brady v1.0 as a production operator platform with governed shell execution, Brady AI, notifications, memory/voice contracts, Genesis Method sync, and CI/CD gates.

**Architecture:** Keep `/Volumes/Stratos_Tools/projects/Connections/projects/mj-mcp-layer` as the implementation authority for the live MJ layer. Add independent modules and routes instead of rewriting the existing Worker; new shell service runs separately on Fly.io and reports every command into the existing Cloudflare/D1 ledger. Worker additions must preserve current `/healthz`, `/mcp`, `/turn/*`, `/audit/*`, `/api/console/lanes`, `/api/ledger`, and `/api/genesis/mcp` behavior.

**Tech Stack:** Cloudflare Workers + D1 + KV + R2 + Queues, Wrangler JSONC, TypeScript, Node 22, ws, node-pty, zod, vitest, Vite React control panel currently in `frontend/`, existing platform tests under `platform/`, GitHub Actions, Fly.io.

---

## Non-Negotiable Reality Checks

- Local source of truth is `Connections`, not `Cloudflare-ellis-aegis`, for `projects/mj-mcp-layer/mcp-layer` live Worker work.
- Current local `Connections/main` is behind `origin/main` by 17 commits. Do not implement on this stale main.
- Current `projects/mj-mcp-layer/frontend` is a Vite React control panel, not the Expo mobile app described in the pasted prompt. Do not delete/regenerate it as Expo until the real Expo app path is found.
- Current Worker config is `projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`, not `wrangler.toml`.
- `wrangler.jsonc` currently contains two `assets` blocks. First task must normalize this before deploy changes.
- GitHub billing/security alert must be resolved before CI/CD can be treated as reliable.
- Any command route that can mutate cloud, memory, voice, tenants, deploys, or source control must require a confirmation path and audit event.

---

## Target Branch And PR Model

**Branch:** `MJ_Layer` if it exists remotely and is the active PR branch. Otherwise create `feature/mj-brady-production-upgrade` from fresh `origin/main`.

**Target:** `main`

**Merge:** squash only, after all required checks pass.

**Commit style:** one commit per task group.

**Before work starts:**

```bash
cd /Volumes/Stratos_Tools/projects/Connections
git fetch origin --prune
git status -sb
git switch main
git pull --ff-only origin main
git switch -c feature/mj-brady-production-upgrade
```

If `MJ_Layer` already exists:

```bash
cd /Volumes/Stratos_Tools/projects/Connections
git fetch origin --prune
git switch MJ_Layer
git merge origin/main --no-ff
```

Expected: no conflict markers remain after merge. If conflicts appear, resolve before Task 1.

---

## File Map

### Existing Files To Modify

- `projects/mj-mcp-layer/mcp-layer/src/index.ts`  
  Add route dispatch only. Keep existing route behavior intact.

- `projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`  
  Normalize duplicate assets block, add vars/bindings only if missing, add preview/local IDs where safe, keep existing binding names `EVIDENCE_BUCKET` and `WATCHER_QUEUE` unless a migration updates all code references.

- `projects/mj-mcp-layer/mcp-layer/package.json`  
  Add missing scripts only if workflows depend on them. Current scripts include `test` and `typecheck`, no `lint` or `build` script.

- `projects/mj-mcp-layer/package.json`  
  Add shell package into golden path only after shell exists and passes locally.

- `the-genesis-method/genesis_loop.sh` or discovered Genesis path  
  Add bounded memory sync call.

- `the-genesis-method/genesis_startup.sh` or discovered Genesis path  
  Add bounded Brady health check.

- `.github/workflows/*.yml`  
  Add focused CI/deploy workflows without duplicating existing `mj-layer-deploy.yml`, `mj-layer-canary.yml`, `mj-layer-scan.yml`, and `mj-enterprise-lanes-deploy.yml` behavior.

### New Files To Create

- `projects/mj-mcp-layer/shell/src/protocol.ts`
- `projects/mj-mcp-layer/shell/src/auth.ts`
- `projects/mj-mcp-layer/shell/src/allowlist.ts`
- `projects/mj-mcp-layer/shell/src/redact.ts`
- `projects/mj-mcp-layer/shell/src/audit.ts`
- `projects/mj-mcp-layer/shell/src/session.ts`
- `projects/mj-mcp-layer/shell/src/index.ts`
- `projects/mj-mcp-layer/shell/src/logger.ts`
- `projects/mj-mcp-layer/shell/tests/*.test.ts`
- `projects/mj-mcp-layer/shell/Dockerfile`
- `projects/mj-mcp-layer/shell/docker-compose.yml`
- `projects/mj-mcp-layer/shell/fly.toml`
- `projects/mj-mcp-layer/shell/.env.example`
- `projects/mj-mcp-layer/shell/README.md`
- `projects/mj-mcp-layer/mcp-layer/src/brady-ai.ts`
- `projects/mj-mcp-layer/mcp-layer/src/notifications.ts`
- `projects/mj-mcp-layer/mcp-layer/src/voice-contract.ts`
- `projects/mj-mcp-layer/mcp-layer/src/memory-contract.ts`
- `projects/mj-mcp-layer/mcp-layer/src/drift-alerts.ts`
- `projects/mj-mcp-layer/mcp-layer/migrations/0002_voice_contract.sql`
- `projects/mj-mcp-layer/mcp-layer/migrations/0003_memory_contract.sql`
- `.github/workflows/shell-ci.yml`
- `.github/workflows/fly-deploy.yml`
- `.github/workflows/worker-ci.yml`
- `.github/workflows/worker-deploy.yml`
- `.github/workflows/gitleaks.yml`
- `.github/dependabot.yml`
- `.github/CODEOWNERS`

---

## Task 0: Safety And Truth Alignment

**Files:** none

- [ ] Verify GitHub account billing and Actions availability.

Run:

```bash
gh auth status
gh repo view Sentinel-Stratos-Strategies/Connections --json nameWithOwner,viewerPermission
```

Expected: authenticated as the intended Sentinel account with write/admin permission.

- [ ] Inventory open PRs and failing checks.

Run:

```bash
gh pr list -R Sentinel-Stratos-Strategies/Connections --state open --json number,title,headRefName,baseRefName,mergeStateStatus,statusCheckRollup
```

Expected: identify whether PR #5 or PR #14 is the active MJ branch.

- [ ] Sync the local repo before coding.

Run:

```bash
git fetch origin --prune
git status -sb
git pull --ff-only origin main
```

Expected: local main equals `origin/main`; no untracked sibling worktree gets staged.

- [ ] Commit no code in this task.

---

## Task 1: Normalize Worker Config And Baseline CI Gates

**Files:**
- Modify: `projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`
- Modify: `projects/mj-mcp-layer/mcp-layer/package.json`

- [ ] Fix duplicate `assets` blocks in `wrangler.jsonc`.

Keep one block that points at the actual built control panel if deploy expects frontend assets:

```jsonc
"assets": {
  "directory": "../frontend/dist",
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  "run_worker_first": [
    "/healthz",
    "/robots.txt",
    "/mcp",
    "/turn/*",
    "/audit/*",
    "/api/*"
  ]
}
```

Remove the second `"assets": { "directory": "public", ... }` unless `public/dashboard` is intentionally replacing `frontend/dist`. If `public` is the intended current deploy target, document the reason in the commit message.

- [ ] Add `build` and `lint` scripts only if they are real.

If there is no linter config yet, do not create a fake lint. Use this instead:

```json
"scripts": {
  "build": "tsc --noEmit",
  "lint": "tsc --noEmit",
  "test": "tsx --test tests/*.test.ts",
  "typecheck": "tsc --noEmit"
}
```

- [ ] Validate current Worker before feature work.

Run:

```bash
npm ci --prefix projects/mj-mcp-layer/mcp-layer --ignore-scripts
npm --prefix projects/mj-mcp-layer/mcp-layer run typecheck
npm --prefix projects/mj-mcp-layer/mcp-layer test
npm --prefix projects/mj-mcp-layer/frontend run build
(cd projects/mj-mcp-layer/mcp-layer && npx wrangler deploy --dry-run)
```

Expected: all pass. If dry-run fails with static asset detection, fix path/context before continuing.

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/mcp-layer/wrangler.jsonc projects/mj-mcp-layer/mcp-layer/package.json
git commit -m "chore(worker): normalize config and baseline gates"
```

---

## Task 2: Build Shell Protocol, Redaction, And Allowlist First

**Files:**
- Create: `projects/mj-mcp-layer/shell/package.json`
- Create: `projects/mj-mcp-layer/shell/tsconfig.json`
- Create: `projects/mj-mcp-layer/shell/src/protocol.ts`
- Create: `projects/mj-mcp-layer/shell/src/redact.ts`
- Create: `projects/mj-mcp-layer/shell/src/allowlist.ts`
- Create: `projects/mj-mcp-layer/shell/tests/protocol.test.ts`
- Create: `projects/mj-mcp-layer/shell/tests/redact.test.ts`
- Create: `projects/mj-mcp-layer/shell/tests/allowlist.test.ts`

- [ ] Scaffold shell package.

Use the package dependencies from the spec, with one correction: add `bcryptjs` because the spec requires bcrypt hash comparison but omitted a bcrypt package.

```json
{
  "name": "mj-brady-shell",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "node-pty": "^1.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "rate-limiter-flexible": "^5.0.0",
    "uuid": "^10.0.0",
    "ws": "^8.21.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] Implement Zod protocol schemas with `parseInboundMessage` and `parseOutboundMessage` exports.

- [ ] Implement `redactSecrets(text: string)` with all requested regexes and return `{ text, redacted }`.

- [ ] Implement `classifyCommand(command, role)` returning one of `allow`, `confirm`, `block` with `confirmPhrase` where required.

- [ ] Tests must cover command length >2000, secret reads, curl GET allow, curl POST block, admin deploy confirm, readonly deploy block, and all redaction patterns.

Run:

```bash
npm ci --prefix projects/mj-mcp-layer/shell
npm --prefix projects/mj-mcp-layer/shell test
npm --prefix projects/mj-mcp-layer/shell run typecheck
```

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/shell
git commit -m "feat(shell): add protocol redaction and command policy"
```

---

## Task 3: Build Shell Auth, Origin Guard, Audit, And PTY Session

**Files:**
- Create: `projects/mj-mcp-layer/shell/src/auth.ts`
- Create: `projects/mj-mcp-layer/shell/src/audit.ts`
- Create: `projects/mj-mcp-layer/shell/src/session.ts`
- Create: `projects/mj-mcp-layer/shell/src/index.ts`
- Create: `projects/mj-mcp-layer/shell/src/logger.ts`
- Create: `projects/mj-mcp-layer/shell/tests/auth.test.ts`
- Create: `projects/mj-mcp-layer/shell/tests/session.test.ts`
- Create: `projects/mj-mcp-layer/shell/tests/smoke.test.ts`

- [ ] Implement origin allowlist during HTTP upgrade.

Allowed origins must come from `ALLOWED_ORIGINS`, defaulting to:

```text
https://mcp.ellis-aegis.us,https://mj.ellis-aegis.us,https://codex.ellis-aegis.us,http://localhost:3000,http://localhost:5173
```

- [ ] Implement token validation against `OPERATOR_TOKEN_HASH` using bcrypt compare.

Use token claims only if JWT verification is configured later; for v1 map valid token to:

```ts
{ userId: "operator", tenantId: "operator", role: "admin" }
```

- [ ] Implement rate limit of 10 auth attempts per IP per minute.

- [ ] Implement PTY sessions with sanitized environment only:

```ts
{
  HOME: "/home/operator",
  TERM: "xterm-256color",
  PATH: "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
}
```

- [ ] Implement confirm flow where confirm-required commands are stored as pending and executed only after exact phrase match.

- [ ] Implement audit fire-and-forget POST to `${MCP_BASE_URL}/api/ledger` with retry count 2 and no output blocking.

- [ ] Smoke tests must cover all 16 requested cases plus Origin rejection.

Run:

```bash
npm --prefix projects/mj-mcp-layer/shell test
npm --prefix projects/mj-mcp-layer/shell run typecheck
```

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/shell
git commit -m "feat(shell): complete authenticated audited PTY service"
```

---

## Task 4: Containerize And Deploy Shell Safely

**Files:**
- Create: `projects/mj-mcp-layer/shell/Dockerfile`
- Create: `projects/mj-mcp-layer/shell/docker-compose.yml`
- Create: `projects/mj-mcp-layer/shell/fly.toml`
- Create: `projects/mj-mcp-layer/shell/.env.example`
- Create: `projects/mj-mcp-layer/shell/README.md`

- [ ] Add Dockerfile exactly as specified, but include `yq` only if the Debian package exists or install via npm/pip with a tested command.

- [ ] Add `.env.example` with:

```dotenv
OPERATOR_TOKEN_HASH=bcrypt_hash_of_your_token
MCP_BASE_URL=https://mcp.ellis-aegis.us
PORT=8080
LOG_LEVEL=info
MAX_SESSIONS=10
IDLE_TIMEOUT_MS=600000
MAX_SESSION_MS=3600000
ALLOWED_ORIGINS=https://mcp.ellis-aegis.us,https://mj.ellis-aegis.us,https://codex.ellis-aegis.us
```

- [ ] Add `docker-compose.yml` for local smoke.

- [ ] Build container locally.

Run:

```bash
docker build -t mj-brady-shell:local projects/mj-mcp-layer/shell
docker run --rm -p 8080:8080 --env-file projects/mj-mcp-layer/shell/.env.local mj-brady-shell:local
```

Expected: service listens on `:8080`, health check responds.

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/shell
git commit -m "chore(shell): add container fly deployment and operator docs"
```

---

## Task 5: Worker Memory Contract Module

**Files:**
- Create: `projects/mj-mcp-layer/mcp-layer/src/memory-contract.ts`
- Create: `projects/mj-mcp-layer/mcp-layer/migrations/0002_memory_contract.sql`
- Modify: `projects/mj-mcp-layer/mcp-layer/src/index.ts`
- Modify: `projects/mj-mcp-layer/mcp-layer/tests/control-plane-policy.test.ts`

- [ ] Add idempotent D1 migration for `memory_entries`.

Use `0002_memory_contract.sql`, not `0006`, because the current repo only has `0001_init.sql`.

- [ ] Export route handlers from `memory-contract.ts`:

```ts
handleMemoryList(request, env)
handleMemoryShow(request, env, id)
handleMemoryUpsert(request, env, ctx)
handleMemoryDelete(request, env, id)
handleMemoryPurge(request, env, ctx)
fetchMemoryContext(tenantId, env)
```

- [ ] Enforce auth via existing `authenticate()` or a shared exported helper. If `authenticate()` is currently private in `index.ts`, first extract it to `src/auth.ts` in a separate small commit.

- [ ] Add policy paths:

```text
GET /api/memory/list
GET /api/memory/show/*
POST /api/memory/upsert
DELETE /api/memory/*
POST /api/memory/purge
```

- [ ] `POST /api/memory/purge` must require request header `x-confirm-phrase: purge memory contract`.

- [ ] Add tests for upsert/list/show/delete/purge auth and confirm behavior.

Run:

```bash
npm --prefix projects/mj-mcp-layer/mcp-layer run typecheck
npm --prefix projects/mj-mcp-layer/mcp-layer test
```

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/mcp-layer
git commit -m "feat(memory): add Memory-Contract D1 routes"
```

---

## Task 6: Worker Voice Contract Module

**Files:**
- Create: `projects/mj-mcp-layer/mcp-layer/src/voice-contract.ts`
- Create: `projects/mj-mcp-layer/mcp-layer/migrations/0003_voice_contract.sql`
- Modify: `projects/mj-mcp-layer/mcp-layer/src/index.ts`
- Modify: `projects/mj-mcp-layer/mcp-layer/tests/control-plane-policy.test.ts`

- [ ] Add `voice_sessions` and `voice_transcripts` D1 migration.

- [ ] Export route handlers:

```ts
handleVoiceSessionStart(request, env, ctx)
handleVoiceSessionEnd(request, env, ctx)
handleVoiceTranscript(request, env, ctx)
handleVoiceSessionGet(request, env, sessionId)
handleVoiceTranscriptList(request, env)
handleVoiceContractRevoke(request, env, ctx)
```

- [ ] Add policy paths for all voice routes.

- [ ] `POST /api/voice/contract/revoke` must require `x-confirm-phrase: revoke voice contract`.

- [ ] Tests must cover session lifecycle, transcript list, revoke confirmation, and revoked session cannot accept new transcripts.

Run:

```bash
npm --prefix projects/mj-mcp-layer/mcp-layer run typecheck
npm --prefix projects/mj-mcp-layer/mcp-layer test
```

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/mcp-layer
git commit -m "feat(voice): add Voice-Contract D1 routes"
```

---

## Task 7: Brady AI And Notification Routes

**Files:**
- Create: `projects/mj-mcp-layer/mcp-layer/src/brady-ai.ts`
- Create: `projects/mj-mcp-layer/mcp-layer/src/notifications.ts`
- Modify: `projects/mj-mcp-layer/mcp-layer/src/index.ts`
- Modify: `projects/mj-mcp-layer/mcp-layer/tests/control-plane-policy.test.ts`

- [ ] Implement `POST /api/mj-brady` with `x-ellis-aegis-token` auth, memory context injection, command intent extraction, and ledger logging.

- [ ] Wrap LLM call in `AbortController` with 25-second timeout.

- [ ] If no LLM key/provider is configured, return a deterministic safe response:

```json
{
  "reply": "MJ Brady is online, but no LLM provider is configured for this environment.",
  "blocked": true,
  "auditId": "..."
}
```

This is not a stub; it is the safe production degraded mode.

- [ ] Implement `POST /api/notifications/register` storing Expo tokens under `notifications:{tenantId}:{tokenId}`.

- [ ] Implement `POST /api/notifications/drift-alert` with internal token auth, Expo fanout, and stale token deletion for `DeviceNotRegistered` responses.

- [ ] Fix malformed payload from prompt: use `data: { tenantId, driftType, severity }`.

- [ ] Tests must cover auth failure, schema failure, memory context included, LLM timeout fallback, token register, drift fanout, stale token deletion.

Run:

```bash
npm --prefix projects/mj-mcp-layer/mcp-layer run typecheck
npm --prefix projects/mj-mcp-layer/mcp-layer test
```

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/mcp-layer
git commit -m "feat(worker): add Brady AI and notification routes"
```

---

## Task 8: Drift Watch Native Worker Scheduling

**Files:**
- Create: `projects/mj-mcp-layer/mcp-layer/src/drift-alerts.ts`
- Modify: `projects/mj-mcp-layer/mcp-layer/src/index.ts`
- Modify: `projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`

- [ ] Keep existing crons unless product owner approves changing frequency. Current crons are `0 */2 * * *` and `15 6 * * *`.

- [ ] Implement `runDriftScanner(env)` as a real check against current Worker-known state: queued watcher dispatch result, D1 recent drift events, and FLAGS policy markers. Do not invent local Sentinel volume visibility inside Cloudflare Worker.

- [ ] If drift is detected, call the same notification fanout helper directly, not HTTP fetch to self.

- [ ] Add tests for no drift, high drift event, and notification dispatch.

Run:

```bash
npm --prefix projects/mj-mcp-layer/mcp-layer run typecheck
npm --prefix projects/mj-mcp-layer/mcp-layer test
```

- [ ] Commit.

```bash
git add projects/mj-mcp-layer/mcp-layer
git commit -m "feat(worker): connect scheduled drift alerts"
```

---

## Task 9: Genesis Method Integration Hook

**Files:**
- Modify: discovered `the-genesis-method/genesis_loop.sh`
- Modify: discovered `the-genesis-method/genesis_startup.sh`
- If Genesis lives outside Connections, commit the integration in that repo and reference the commit in MJ PR notes.

- [ ] Locate real Genesis scripts.

Run:

```bash
find /Volumes/Stratos_Tools/projects -path '*genesis_loop.sh' -o -path '*genesis_startup.sh'
```

- [ ] Add memory sync with strict network bounds:

```bash
curl -sS --max-time 3 --retry 1 -X POST "$MCP_BASE_URL/api/memory/upsert" \
  -H "Content-Type: application/json" \
  -H "x-ellis-aegis-token: $OPERATOR_TOKEN" \
  -d "$GENESIS_MEMORY_PAYLOAD" > /dev/null || \
  echo "[genesis_loop] WARNING: MJ Brady memory sync failed"
```

- [ ] Add startup health check with `--max-time 3`.

- [ ] Shellcheck scripts.

Run:

```bash
shellcheck the-genesis-method/genesis_loop.sh the-genesis-method/genesis_startup.sh
```

- [ ] Commit in correct repo.

```bash
git add the-genesis-method/genesis_loop.sh the-genesis-method/genesis_startup.sh
git commit -m "feat(genesis): sync loop state to MJ Brady memory"
```

---

## Task 10: CI/CD Without Duplicating Existing Workflows

**Files:**
- Create: `.github/workflows/shell-ci.yml`
- Create: `.github/workflows/fly-deploy.yml`
- Create: `.github/workflows/worker-ci.yml`
- Create: `.github/workflows/worker-deploy.yml`
- Create: `.github/workflows/gitleaks.yml`
- Create or Modify: `.github/dependabot.yml`
- Create or Modify: `.github/CODEOWNERS`

- [ ] Do not create duplicate workflows if equivalent existing workflow already covers the same event and path.

Existing workflows already present:

```text
mj-layer-scan.yml
mj-layer-canary.yml
mj-layer-deploy.yml
mj-enterprise-lanes-deploy.yml
```

- [ ] Add `shell-ci.yml` only for `projects/mj-mcp-layer/shell/**`.

- [ ] Add `fly-deploy.yml` only for `main` pushes touching shell.

- [ ] Add `worker-ci.yml` only if existing `mj-layer-deploy.yml` PR validation is too broad or unreliable. Required steps:

```bash
npm ci
npm run typecheck
npm test
npx wrangler deploy --dry-run
```

- [ ] Add `worker-deploy.yml` only after deciding whether deploys should remain manual via existing `mj-layer-deploy.yml` or automatic on `main`. Production recommendation: manual environment approval, not blind push-to-main deploy.

- [ ] Add `gitleaks.yml` for all PRs to `main`.

- [ ] Add Dependabot for `shell`, `mcp-layer`, `frontend`, `platform`, and GitHub Actions.

- [ ] Add CODEOWNERS, but verify the team slug exists before using it.

Run:

```bash
gh api orgs/Sentinel-Stratos-Strategies/teams --jq '.[].slug'
```

If `operators` does not exist, use the actual available team slug or use the repo owner handle.

- [ ] Validate workflow YAML.

Run:

```bash
python3 - <<'PY'
import pathlib, yaml
for p in pathlib.Path('.github/workflows').glob('*.yml'):
    yaml.safe_load(p.read_text())
    print('ok', p)
PY
```

- [ ] Commit.

```bash
git add .github
git commit -m "ci: add MJ Brady shell worker security and dependency gates"
```

---

## Task 11: D1 Migration Deployment Plan

**Files:**
- Modify: `.github/workflows/mj-layer-deploy.yml` or new `worker-deploy.yml`

- [ ] Apply migrations in order during deploy.

Preferred command from `projects/mj-mcp-layer/mcp-layer`:

```bash
npx wrangler d1 migrations apply ellis-aegis-control-plane --remote
```

If Wrangler migration tracking is not configured, use explicit files:

```bash
npx wrangler d1 execute ellis-aegis-control-plane --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute ellis-aegis-control-plane --remote --file=./migrations/0002_memory_contract.sql
npx wrangler d1 execute ellis-aegis-control-plane --remote --file=./migrations/0003_voice_contract.sql
```

- [ ] Add post-migration smoke query.

```bash
npx wrangler d1 execute ellis-aegis-control-plane --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('memory_entries','voice_sessions','voice_transcripts');"
```

- [ ] Commit if workflow changed.

```bash
git add .github/workflows/mj-layer-deploy.yml .github/workflows/worker-deploy.yml
git commit -m "ci(worker): apply D1 contract migrations before deploy"
```

---

## Task 12: PR Conflict Resolution And Final Golden Gate

**Files:**
- Modify only conflict files such as `projects/mj-mcp/README.md`

- [ ] Merge latest main into feature branch.

```bash
git fetch origin --prune
git merge origin/main --no-ff
```

- [ ] If `projects/mj-mcp/README.md` conflicts, keep the full MJ Layer stack block and remove all conflict markers.

Verify:

```bash
rg -n '<<<<<<<|=======|>>>>>>>' .
```

Expected: no output.

- [ ] Run golden gates.

```bash
npm --prefix projects/mj-mcp-layer run mj:golden
npm --prefix projects/mj-mcp-layer/shell run typecheck
npm --prefix projects/mj-mcp-layer/shell test
npm audit --prefix projects/mj-mcp-layer/mcp-layer --audit-level=high
npm audit --prefix projects/mj-mcp-layer/shell --audit-level=high
(cd projects/mj-mcp-layer/mcp-layer && npx wrangler deploy --dry-run)
git diff --check
```

- [ ] Push branch.

```bash
git push -u origin HEAD
```

- [ ] Open PR.

```bash
gh pr create \
  --title "feat: MJ Brady v1.0 production upgrade" \
  --body-file docs/superpowers/plans/2026-05-22-mj-brady-production-upgrade.md \
  --base main
```

---

## Branch Protection Checklist

After CI exists and passes, set branch protection manually or via GitHub API:

- Require PR before merging.
- Require 1 approval.
- Dismiss stale reviews.
- Require CODEOWNERS review.
- Require status checks that actually exist after first workflow run.
- Require branch up to date.
- Block force pushes.
- Do not require signed commits until the team confirms all agents can sign commits reliably.

---

## Deferred Until Real Expo App Is Located

The pasted prompt's Expo `app.json`, `eas.json`, notification icon, WAV, and Expo build workflow are valid only after locating the actual Expo app. The current `projects/mj-mcp-layer/frontend` is Vite React and must not be converted blindly.

Discovery command:

```bash
find /Volumes/Stratos_Tools/projects/Connections -name app.json -o -name app.config.ts -o -name eas.json
```

If no Expo app exists in this repo, create a separate mobile PR rather than mixing mobile scaffolding into the Worker/shell PR.

---

## Final Definition Of Done

- `mcp-layer` existing routes still pass smoke tests.
- Shell service rejects unauthenticated and bad-origin WebSockets.
- Shell commands are allowlisted, confirmation-gated, redacted, and audited.
- `/api/mj-brady` responds with memory context and safe timeout behavior.
- Notification registration and drift-alert fanout work and delete dead Expo tokens.
- Memory and voice D1 tables exist in remote production D1.
- Genesis loop sync cannot stall the Genesis engine longer than 3 seconds.
- CI blocks high/critical audits and secret leaks.
- PR has no conflict markers, no TODOs, no fake lint scripts, no duplicate Worker configs.
