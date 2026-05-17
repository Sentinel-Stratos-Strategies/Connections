# Gemini Handoff — MJ Layer & Console Lanes (2026-05-17)

**Purpose:** Single pickup doc for Gemini (or any coding agent) after MJ deployment and repo alignment. Canonical live verification detail remains in [`MJ-ACTIVE-DOMAINS-AND-MINI-LANES-2026-05-17.md`](./MJ-ACTIVE-DOMAINS-AND-MINI-LANES-2026-05-17.md).

**Assumed state:** Dirty trees resolved; console lanes aligned; MJ layer deployed and verified; working trees clean relative to the branches named below.

---

## 1. What was completed (summary)

### Connections repository

| Area | Change |
| --- | --- |
| Console lanes | Added **`mj-antigravity`** and **`mj-orbstack`** to `CONSOLE_LANES` and `infrastructure-connections.json`. |
| Project lanes | Added **`kevis-mcp`** and **`hitch-mcp`** to `infrastructure-connections.json`. |
| Edge routing | **`mj-edge-routing.yaml`** aligned with live split-worker reality (Codex served by **`ellis-aegis-control-plane`**). |
| Tests | **`control-plane-policy.test.ts`** updated to expect **36** lanes; **`npm test`** passes. |
| Git | Committed on branch **`verify/mj-edge-routes-2026-05-17`** (includes previously untracked lane definitions). |

### Cloudflare-ellis-aegis repository

| Area | Change |
| --- | --- |
| Lane registry | **`lane-registry.ts`** aligned with **36** lanes (**`mj-antigravity`**, **`mj-orbstack`** added). |
| Tests | **`mcp-surface.test.ts`** updated for 36-lane registry. |
| Git | Committed on branch **`fix/preflight-zone-vars-and-verify-routes`**. |

### Deployments

| Component | Source repo | Status |
| --- | --- | --- |
| **mj-edge** | Connections | Deployed successfully. |
| **ellis-aegis-control-plane** | Cloudflare-ellis-aegis | Deployed successfully. |

### Handoff / verification artifact

- **`Connections/projects/mj-mcp-layer/docs/handoffs/MJ-ACTIVE-DOMAINS-AND-MINI-LANES-2026-05-17.md`** — authenticated `curl` results recorded; tunnel + lane registry checks documented.

---

## 2. Deployment proof (live)

Use these as regression probes after future deploys:

1. **Main MCP tunnel:** `https://mcp.ellis-aegis.us/mcp` → expect **`protocol: mcp`** (verified).
2. **Lane registry:** `https://api.ellis-aegis.us/api/console/lanes` → expect **`count: 36`** (verified).
3. **New lanes (live):** **`mj-antigravity`**, **`mj-orbstack`** (verified).

Full host/route table and health checks: see **MJ-ACTIVE-DOMAINS-AND-MINI-LANES-2026-05-17.md**.

---

## 3. Branches to sync before new work

| Repository | Branch |
| --- | --- |
| Connections | `verify/mj-edge-routes-2026-05-17` |
| Cloudflare-ellis-aegis | `fix/preflight-zone-vars-and-verify-routes` |

Merge strategy is a team choice; do not assume `main` contains these commits until merged.

---

## 4. Invariants for the next agent

1. **Lane count:** Console/policy tests and **`/api/console/lanes`** are pinned to **36** lanes until intentionally expanded again.
2. **Split worker:** Routing docs and **`mj-edge-routing.yaml`** must stay consistent with **Codex → ellis-aegis-control-plane** where that split applies.
3. **Secrets:** Authenticated checks use **`OPERATOR_TOKEN`** (or current equivalent); do not commit tokens.
4. **Vectorize / MUA:** Index creation may still be deferred per **`MUA_LAYER_MASTER_PLAN.md`** — do not treat absence as a deployment failure unless that doc says otherwise.

---

## 5. Suggested next commands (local sanity)

From each repo root (after `git checkout` of the branches above):

```bash
npm ci
npm test
```

Connections: confirm **`control-plane-policy.test.ts`** still expects **36** lanes.  
Cloudflare-ellis-aegis: confirm **`mcp-surface.test.ts`** matches registry count.

---

## 6. Ready-for-instructions

Platform alignment and deployment verification described in this handoff are complete; next work should state explicit goals (e.g. merge to `main`, add lane #37, rotate tokens, or extend MJ-mini-lane docs).
