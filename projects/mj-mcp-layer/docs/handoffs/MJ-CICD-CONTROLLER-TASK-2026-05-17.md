# MJ CI/CD Controller Task

Date: 2026-05-17
Controller: Codex truth-source lane

## Current Truth Sources

- Connections repo: `/Volumes/Stratos_Tools/projects/Connections`
- Connections GitHub repo: `Sentinel-Stratos-Strategies/Connections`
- Connections baseline: `main` at `commit-sha-placeholder`
- Cloudflare repo: `/Volumes/Stratos_Tools/projects/Cloudflare-ellis-aegis`
- Cloudflare GitHub repo: `Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis`
- Cloudflare baseline: `main` at `commit-sha-placeholder`
- Production MJ endpoint target: `https://mcp.ellis-aegis.us`
- Production Worker name: `mj-edge`

## Non-Negotiable Guardrails

1. Do not edit DNS in this task. DNS ownership is held by the Cloudflare DNS agent.
2. Do not print, commit, paste, or expose token values. Secret names may be referenced; secret values stay in local `.env` or GitHub Secrets.
3. Do not edit the duplicate root checkout `/Volumes/Stratos_Tools/Cloudflare-ellis-aegis`.
4. Do not add public exposure for local bridge lanes such as OrbStack, local models, Marvin, Harbor, or Diggs.
5. Do not add a lane unless it has both a `lane.manifest.json` and an `infrastructure-connections.json` row.
6. Do not mark deploy complete unless GitHub Actions produced deploy/smoke evidence artifacts.
7. Do not switch automatic production deploy on for `main` without explicit approval.

## Builder Assignment

The builder owns implementation only. The controller owns validation, task acceptance, CI/CD dispatch, and final go/no-go.

### Task A: Push Validation Unblockers

- In Connections, keep the mini-lane mesh aligned:
  - `projects/mj-mcp/connections/infrastructure-connections.json`
  - `projects/mj-mcp/lanes/orbstack/lane.manifest.json`
  - `projects/mj-mcp/lanes/kevis-mcp/lane.manifest.json`
  - `projects/mj-mcp/lanes/hitch-mcp/lane.manifest.json`
  - `projects/mj-mcp-layer/scripts/validate-mini-lanes.mjs`
- In Cloudflare, keep Wrangler CI on Node 22:
  - `.github/workflows/cloudflare-deploy.yml`

### Task B: Required Local Gates

Run these before any push:

```bash
cd /Volumes/Stratos_Tools/projects/Connections
node projects/mj-mcp-layer/scripts/validate-mini-lanes.mjs
npm --prefix projects/mj-mcp-layer/mcp-layer test

cd /Volumes/Stratos_Tools/projects/Cloudflare-ellis-aegis/mcp-layer
npm run check
npm test
```

Expected minimum:

- Mini lanes: `ok 43 manifests / 43 connections`
- Connections Worker tests: 8 passing
- Cloudflare MUA tests: 29 passing

### Task C: Required GitHub Actions Sequence

Use the keyring GitHub CLI path, not an exported token:

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh auth status -h github.com
env -u GITHUB_TOKEN -u GH_TOKEN gh api user --jq '.login'
```

Expected active account: `joeathan`.

After pushing the unblocker commits:

1. Confirm Cloudflare validation:

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh run list \
  -R Sentinel-Stratos-Strategies/Cloudflare-ellis-aegis \
  --workflow "Cloudflare Deploy and Harden" \
  --limit 5
```

2. Dispatch MJ deploy manually:

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh workflow run "MJ Layer Deploy" \
  -R Sentinel-Stratos-Strategies/Connections \
  --ref main \
  -f run_hardening=false
```

3. Watch and inspect the deploy run:

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh run watch \
  -R Sentinel-Stratos-Strategies/Connections
```

4. Run canary proof dry-run:

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh workflow run "MJ Layer Canary Proof" \
  -R Sentinel-Stratos-Strategies/Connections \
  --ref main \
  -f base_url=https://mcp.ellis-aegis.us \
  -f execute_apply=false
```

5. Only after deploy smoke passes, request explicit approval before:

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh workflow run "MJ Layer Deploy" \
  -R Sentinel-Stratos-Strategies/Connections \
  --ref main \
  -f run_hardening=true
```

## Acceptance Gates

- `validate-mini-lanes.mjs` enforces lane IDs shaped as `mj-*` and rejects unsupported manifest auth modes.
- GitHub secret inventory exists for required names; values are never printed.
- Connections deploy validation uploads `mj-layer-validation-evidence`.
- Connections manual deploy uploads deployment manifest and smoke evidence.
- Cloudflare validation no longer fails on Wrangler Node version.
- No `.env`, backup env, token map, key, PEM, or credential JSON file appears in `git status`.
- Local bridge lanes remain localhost-only.
- DNS remains unchanged by this task.

## Reviewer Checklist

- Check latest commit SHAs in both repos before approving.
- Verify the latest failed CI logs are not stale failures from pre-fix SHAs.
- Check `git status --short` in both repos before any push.
- Check Actions artifacts before saying deployed.
- If a deploy fails, review the failed step logs and fix only the failing surface.
- Do not broaden this into billing, dashboard auth, customer portal, or DNS.

## Known Follow-Up

- Scheduled drift scans are failing independently and should be triaged after the deploy lane is green.
- `run_hardening=true` is a separate production hardening action and should remain manual.
- Productization lanes such as billing, tenant provisioning, customer portal, and Workers for Platforms remain future commercial build tracks, not blockers for this MJ CI/CD activation.
