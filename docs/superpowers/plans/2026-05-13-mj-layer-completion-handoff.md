# MJ Layer Completion Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the MJ Layer enterprise branch without scope drift, land the safe host-first control plane, and queue the commercial productization layer as a separate follow-on project.

**Architecture:** The current enterprise runtime lives in `projects/mj-mcp-layer/` and the separate mini-MJ connector mesh lives in `projects/mj-mcp/`. Cloudflare is the first runtime substrate for Workers, D1, R2, KV, Queues, routes, and hardening policy; productized billing, dynamic dispatch, customer portal, and automated custom hostnames are not part of the current PR unless explicitly pulled into a follow-on branch.

**Tech Stack:** Cloudflare Workers, Wrangler, D1, KV, R2, Queues, GitHub Actions, TypeScript, Node test runner, YAML/JSON manifests, Linear for task control, GitHub PR #5 for review.

---

## Current State Snapshot

- Repo: `Sentinel-Stratos-Strategies/Connections`
- Local checkout: `/Volumes/Stratos_Tools/projects/Connections-cursor-review`
- Branch: `cursor/mj-layer-enterprise-ready-1c9b`
- PR: `https://github.com/Sentinel-Stratos-Strategies/Connections/pull/5`
- Head SHA at handoff: `76a5e17030589d02510eb68fffaf4655cf5036ef`
- Base branch: `MJ_Layer`
- GitHub merge state at handoff: `DIRTY`
- Known merge conflict from `git merge-tree`: `projects/mj-mcp/README.md` only.

## Non-Negotiable Boundaries

- Do not deploy, merge, or rotate secrets without explicit operator approval.
- Keep `apps-connectors/security-agent/**` separate; that is the Phase-0 security-agent lane, not this PR.
- Keep `projects/mj-mcp/` as the mini-lane mesh and `projects/mj-mcp-layer/` as the enterprise runtime.
- Do not claim the commercial SaaS/PaaS blueprint is implemented in PR #5. It is a follow-on productization track.
- No automatic DNS/route cutover. Route changes stay manual and approval-gated.

## Verification Baseline

Run these before and after each code-bearing task:

```bash
cd /Volumes/Stratos_Tools/projects/Connections-cursor-review
npm --prefix projects/mj-mcp-layer/mcp-layer run typecheck
npm --prefix projects/mj-mcp-layer/mcp-layer test
npm --prefix projects/mj-mcp-layer/platform run typecheck
npm --prefix projects/mj-mcp-layer/platform test
npm --prefix projects/mj-mcp-layer/platform run build
npx wrangler deploy --dry-run --cwd projects/mj-mcp-layer/mcp-layer
bash -n projects/mj-mcp-layer/cloudflare/*.sh
node - <<'NODE'
const fs = require("node:fs");
for (const file of [
  "projects/mj-mcp/connections/infrastructure-connections.json",
  "projects/mj-mcp/schemas/infrastructure-connections.schema.json",
  "projects/mj-mcp-layer/manifests/deployment/deployment-manifest.schema.json",
  "projects/mj-mcp-layer/manifests/deployment/deployment-manifest.example.json"
]) JSON.parse(fs.readFileSync(file, "utf8"));
console.log("json manifests ok");
NODE
```

Expected:

- Worker tests: all pass.
- Platform tests: all pass.
- Platform build: succeeds.
- Wrangler dry-run: exits without deploying and lists `FLAGS`, `WATCHER_QUEUE`, `DB`, `EVIDENCE_BUCKET`.
- Shell syntax: no output and exit code `0`.
- JSON manifest check: `json manifests ok`.

---

### Task 1: Resolve PR Merge Drift

**Files:**
- Modify: `projects/mj-mcp/README.md`

- [ ] **Step 1: Verify the conflict without mutating the branch**

Run:

```bash
cd /Volumes/Stratos_Tools/projects/Connections-cursor-review
git fetch origin --prune
git merge-tree "$(git merge-base HEAD origin/MJ_Layer)" HEAD origin/MJ_Layer | sed -n '1,180p'
```

Expected: the only conflict is `projects/mj-mcp/README.md`.

- [ ] **Step 2: Resolve the README content by preserving both meanings**

Keep the `connections/` and `infrastructure-connections.schema.json` directory map entries, and use this build-status wording:

```markdown
## Build status

This scaffold is intentionally separate from the enterprise runtime in `projects/mj-mcp-layer/`.
It defines mini-MJ lane contracts and the connection map that lets Codex, Cloudflare, GitHub,
OpenAI, Google, Notion, Linear, and future lanes attach to the enterprise control plane without
becoming a single over-privileged integration.
```

- [ ] **Step 3: Run the full verification baseline**

Run every command from `Verification Baseline`.

- [ ] **Step 4: Commit and push the conflict resolution**

```bash
git add projects/mj-mcp/README.md
git commit -m "docs: resolve mj mini-lane handoff drift"
git push origin cursor/mj-layer-enterprise-ready-1c9b
```

- [ ] **Step 5: Confirm PR merge state**

```bash
gh pr view 5 --repo Sentinel-Stratos-Strategies/Connections \
  --json number,title,state,headRefOid,mergeStateStatus,statusCheckRollup,url
```

Expected: `mergeStateStatus` is no longer `DIRTY`.

---

### Task 2: Run Diff-Scoped Security Review

**Files:**
- Create: `projects/mj-mcp-layer/docs/security/PR5_SECURITY_REVIEW.md`
- Read: `.github/workflows/mj-layer-deploy.yml`
- Read: `projects/mj-mcp-layer/mcp-layer/src/index.ts`
- Read: `projects/mj-mcp-layer/platform/src/adapters/*.ts`
- Read: `projects/mj-mcp-layer/cloudflare/*.sh`

- [ ] **Step 1: Freeze scan target**

```bash
cd /Volumes/Stratos_Tools/projects/Connections-cursor-review
git fetch origin --prune
git diff --name-only origin/MJ_Layer...HEAD > /tmp/mj-pr5-files.txt
cat /tmp/mj-pr5-files.txt
```

Expected: file list matches PR #5 and does not include `apps-connectors/security-agent/**`.

- [ ] **Step 2: Threat model the changed surfaces**

Write `projects/mj-mcp-layer/docs/security/PR5_SECURITY_REVIEW.md` with these sections:

```markdown
# PR5 Security Review

## Scope

- PR: #5
- Branch: cursor/mj-layer-enterprise-ready-1c9b
- Base: MJ_Layer
- Excluded: apps-connectors/security-agent/**

## Threat Model

- Worker control-plane endpoints: auth, capability headers, CORS, JSON parsing, SQL query limits.
- GitHub Actions: secret exposure, unintended deploy, DNS/route cutover, artifact leakage.
- Cloudflare scripts: API token scope, idempotency, destructive route/ruleset mutations.
- Platform adapters: false success from unsupported providers, rollback failure, evidence integrity.
- Mini lanes: overbroad connector permissions and cross-lane data movement.
```

- [ ] **Step 3: Discovery checklist**

Append this checklist and mark each row during review:

```markdown
## Discovery Checklist

- [ ] Protected Worker routes require policy headers before auth side effects.
- [ ] Missing runtime secrets do not leak internal configuration to clients.
- [ ] Query limits cannot become NaN, negative, or unbounded SQL.
- [ ] Non-Cloudflare adapters do not claim executed mutations while stubbed.
- [ ] Manual deploy workflow cannot run on push.
- [ ] Hardening/scan runs only after manual deploy and smoke.
- [ ] Mini-lane manifests do not grant `secret.read`, `policy_control.bypass`, or unrestricted truth writes.
- [ ] Cloudflare scripts avoid printing secret values.
```

- [ ] **Step 4: Validate findings**

For each plausible issue, include:

```markdown
## Finding N: <title>

- Status: reportable | suppressed | deferred
- Affected lines:
- Attack path:
- Control evidence:
- Fix:
- Verification:
```

If no reportable issues remain, state that explicitly and list residual risks.

- [ ] **Step 5: Run the verification baseline**

Run every command from `Verification Baseline`.

---

### Task 3: Host-First Cloudflare Connection

**Files:**
- Read: `projects/mj-mcp-layer/docs/runbooks/CLOUDFLARE_DOMAIN_CONNECTION.md`
- Read: `projects/mj-mcp-layer/docs/runbooks/GITHUB_SECRETS_REQUIRED.md`
- Read: `projects/mj-mcp-layer/mcp-layer/wrangler.jsonc`
- Output: `projects/mj-mcp-layer/artifacts/mj-mcp-layer/deployment-manifest.json`

- [ ] **Step 1: Confirm required secrets are present, without printing values**

```bash
for name in CF_API_TOKEN CF_ACCOUNT_ID CF_ZONE_ID_ELLIS CF_ZONE_ID_HITCH CF_ZONE_ID_KEVIS OPERATOR_TOKEN; do
  if [ -n "${!name:-}" ]; then echo "$name=present"; else echo "$name=missing"; fi
done
```

Expected: all required secrets are present before deploy. If any are missing, stop.

- [ ] **Step 2: Validate Cloudflare auth**

```bash
cd /Volumes/Stratos_Tools/projects/Connections-cursor-review/projects/mj-mcp-layer/mcp-layer
npx wrangler whoami
```

Expected: Wrangler reports the intended Cloudflare identity/account.

- [ ] **Step 3: Apply D1 migration**

```bash
npx wrangler d1 execute ellis-aegis-control-plane --remote --file=./migrations/0001_init.sql
```

Expected: migration succeeds without dropping or truncating existing tables.

- [ ] **Step 4: Deploy only after dry-run passes**

```bash
npx wrangler deploy --dry-run
npx wrangler deploy
```

Expected: Worker `mj-edge` deploys with bindings `DB`, `FLAGS`, `EVIDENCE_BUCKET`, `WATCHER_QUEUE`.

- [ ] **Step 5: Smoke test**

```bash
OPERATOR_TOKEN="$OPERATOR_TOKEN" npm run smoke -- --base-url https://mcp.ellis-aegis.us
npm run manifest:deployment
```

Expected:

- `/healthz` returns `200`.
- `/mcp` without policy headers returns `403`.
- `/mcp` with policy headers and auth returns `200`.
- `/api/change-request` cannot bypass policy.
- `/api/ledger?limit=abc` succeeds with bounded fallback.
- `/audit/events?limit=abc` succeeds with `forensic.read`.
- Deployment manifest status is `go`.

---

### Task 4: Mini-Lane Connection Control

**Files:**
- Read: `projects/mj-mcp/connections/infrastructure-connections.json`
- Read: `projects/mj-mcp/lanes/*/lane.manifest.json`
- Modify only if needed: `projects/mj-mcp/connections/infrastructure-connections.json`

- [ ] **Step 1: Validate lane manifests**

```bash
node - <<'NODE'
const fs = require("node:fs");
const laneDirs = fs.readdirSync("projects/mj-mcp/lanes", { withFileTypes: true }).filter((entry) => entry.isDirectory());
for (const entry of laneDirs) {
  const file = `projects/mj-mcp/lanes/${entry.name}/lane.manifest.json`;
  const lane = JSON.parse(fs.readFileSync(file, "utf8"));
  if (lane.dataBoundaries.truthWrite !== "denied" && lane.dataBoundaries.truthWrite !== "internal_only") {
    throw new Error(`${file} has unsafe truthWrite=${lane.dataBoundaries.truthWrite}`);
  }
  if (lane.deniedActions.includes("secret.read") === false) {
    throw new Error(`${file} must deny secret.read`);
  }
}
console.log(`validated ${laneDirs.length} mini lanes`);
NODE
```

Expected: all mini lanes validate.

- [ ] **Step 2: Connect only the first three operational lanes**

Initial live-connection order:

1. `mj-codex`: `https://codex.ellis-aegis.us/mcp`
2. `mj-github`: `https://mcp.ellis-aegis.us/mcp`
3. `mj-cloudflare`: `https://mcp.ellis-aegis.us/mcp`

Do not connect OpenAI, Google, Notion, Linear, Gadget, Vercel, or Railway to write-capable operations until Codex/GitHub/Cloudflare smoke and audit are stable.

- [ ] **Step 3: Record lane smoke evidence**

Append lane smoke results to the deployment manifest or create `projects/mj-mcp-layer/artifacts/mj-mcp-layer/lane-smoke-results.json` with:

```json
{
  "generated_at": "ISO-8601 timestamp",
  "lanes": [
    { "lane": "mj-codex", "status": "pass", "evidence": "mcp auth smoke passed" },
    { "lane": "mj-github", "status": "pending", "evidence": "requires GitHub App/OIDC confirmation" },
    { "lane": "mj-cloudflare", "status": "pending", "evidence": "requires CF_API_TOKEN scoped smoke" }
  ]
}
```

---

### Task 5: Productization Follow-On Track

**Files:**
- Create: `projects/mj-mcp-layer/docs/productization/PRODUCTIZATION_BLUEPRINT.md`
- Do not modify current runtime until this becomes a separate branch.

- [ ] **Step 1: Create the blueprint doc**

Create a document with these headings:

```markdown
# MJ Layer Productization Blueprint

## Not in PR #5

- Stripe checkout/subscription webhooks
- Billing idempotency table
- Financial kill switch
- Dynamic dispatch / Workers for Platforms
- Tenant provisioning service
- Automated custom hostname lifecycle
- Customer portal
- Admin support dashboard
- Edge analytics and FinOps circuit breaker

## Alpha Build Order

1. Tenant and subscription schema
2. Stripe webhook intake
3. Compute kill switch
4. Custom hostname provisioning
5. Dynamic dispatch namespace
6. Admin telemetry dashboard
7. Customer portal
8. Agentic provisioning API
```

- [ ] **Step 2: Keep commercial work out of PR #5**

Open a new branch after PR #5 is merge-clean:

```bash
git checkout MJ_Layer
git pull --ff-only origin MJ_Layer
git checkout -b feature/mj-layer-productization-alpha
```

Expected: commercial productization starts from a clean enterprise base.

---

## Linear Task Breakdown

Create one Linear project:

- Name: `MJ Layer Completion Airlock`
- Summary: `Land PR #5 safely, connect Cloudflare host-first, and queue productization as a separate track.`
- Target date: `2026-05-13`

Create these issues:

1. `Resolve PR #5 merge drift`
2. `Run PR #5 security review`
3. `Execute host-first Cloudflare deploy checklist`
4. `Smoke Codex/GitHub/Cloudflare mini lanes`
5. `Publish productization alpha blueprint`
6. `Prepare reviewer handoff and go/no-go note`

---

## Go/No-Go Rules

Go only when:

- PR merge state is clean.
- Verification baseline passes.
- Security review has no unresolved reportable high/critical findings.
- Host deploy smoke returns go-status deployment manifest.
- Mini-lane writes remain scoped and audited.

No-go when:

- PR merge state remains `DIRTY`.
- Any protected route bypasses policy headers.
- Any provider stub reports real execution.
- Secrets are missing or printed in logs.
- Productization work starts inside PR #5 before enterprise landing.
