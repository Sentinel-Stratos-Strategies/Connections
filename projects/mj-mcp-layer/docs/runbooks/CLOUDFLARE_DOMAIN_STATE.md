# Cloudflare Domain State

Last updated: 2026-05-03
Branch: MJ_Layer
Source of truth: Connections/projects/mj-mcp-layer

## Operating Model

Domain is authority. ellis-aegis.us is the owning authority zone for the Genesis OS / MJ Layer control plane.

MJ Layer is the permanent orchestrator. It governs cloud shell access, MCP, AI-worker policy, storage routing, audit, and project lanes across local and cloud systems.

Each client/project gets an individualized road through MJ Layer:

- its own domain or subdomain authority surface
- its own protected endpoint path
- its own storage boundary
- optional project Worker
- optional Pages app
- optional AI binding
- shared governance through the master MJ Layer

No project domain should bypass MJ Layer for protected operations. Public web surfaces may be served by Pages or another origin, but protected API/MCP/storage/AI flows route through the MJ control plane.

## Authority Zone

ellis-aegis.us owns the main orchestration layer.

Permanent role hostnames:

- mj.ellis-aegis.us: primary MJ Layer operator/control-plane entry.
- mcp.ellis-aegis.us: MCP protocol entry for tools and project roads.
- codex.ellis-aegis.us: Codex/operator-specific secured MCP lane.

Existing MJ routes observed on Cloudflare point these hosts to the mj-edge Worker. Keep this model as the master layer.

## Project Lane Pattern

Use this pattern for each project domain:

- project-domain.tld/: public authority surface, launch page, app, or staged holding surface.
- project-domain.tld/api/*: project-specific Worker lane when the project needs app-specific API behavior.
- project-domain.tld/mcp/*: protected MJ Layer route for MCP/project orchestration.
- project-domain.tld/turn/*: protected turn/session persistence route through MJ Layer.
- project-domain.tld/audit/*: protected audit route through MJ Layer.

The /mcp, /turn/*, and /audit/* lanes should remain deny-by-default and require the MJ Layer header/token policy.

## Kevis Lane

Domain: kevis.online

Launch posture: MJ-first. Kevis is not ready to be sold as a finished public app yet, so the domain should not expose an unfinished app as the primary authority surface.

Current Cloudflare resources:

- Pages project: kevis-web
- Latest verified Pages preview: https://0d2bd0b9.kevis-web.pages.dev
- R2 bucket: kevis-media
- KV namespace reused: mj-edge-shared
- Project Worker: kevis-mj-edge
- Worker route installed: kevis.online/api/* -> kevis-mj-edge

Desired routing:

- kevis.online/: MJ-controlled authority/holding/sales surface until the app is production-ready.
- kevis.online/app or a future selected app path: Kevis Pages app when ready.
- kevis.online/api/*: keep routed to kevis-mj-edge for project-specific API behavior.
- kevis.online/mcp/*: route to master mj-edge after DNS authority is stable.
- kevis.online/turn/*: route to master mj-edge after DNS authority is stable.
- kevis.online/audit/*: route to master mj-edge after DNS authority is stable.

Storage boundary:

- kevis-media should support mixed storage with signed URLs for private files.
- Public media may be exposed intentionally.
- Private project data must remain signed/protected and tenant-scoped.

Open blocker:

- kevis.online and www.kevis.online currently do not resolve publicly from verification checks. Finish DNS only after Cloudflare transfer/delegation is stable.

## Hitch Lane

Domain: hitch.guru

Transfer posture: currently transferring from Namecheap to Cloudflare. Treat DNS authority as pending until Cloudflare fully owns/delegates the zone.

Desired routing:

- hitch.guru/: public Hitch surface once origin is confirmed.
- hitch.guru/api/*: project Worker lane if Hitch needs app-specific API behavior.
- hitch.guru/mcp/*: route to master mj-edge after DNS authority is stable.
- hitch.guru/turn/*: route to master mj-edge after DNS authority is stable.
- hitch.guru/audit/*: route to master mj-edge after DNS authority is stable.

Open blocker:

- Confirm the final Hitch public origin before creating apex/www records. Previous manifests referenced Gadget, but this must be verified before cutover.

## Security Defaults

- Tenant separation is mandatory.
- Protected routes are deny-by-default.
- Audit writes are required for admin, cloud shell, storage, AI, and MCP operations.
- Training-data retention must be explicit per client/project before ingesting project data into reusable training sets.
- Rotate any exposed development/global/API tokens after emergency setup is complete.

## Green Checklist

A domain lane is green only when all items pass:

- Cloudflare zone active and delegated.
- Required DNS records resolve publicly.
- Worker deploy succeeds.
- Pages deploy succeeds if the project uses Pages.
- Public surface returns expected status.
- /api/health or project health endpoint returns expected status.
- /mcp/* secured-path checks pass.
- /turn/* method and auth checks pass.
- /audit/* auth checks pass.
- WAF/rate-limit/cache policy is applied.
- Audit event written for final cutover.

## Immediate Next Moves

1. Keep ellis-aegis.us as the master MJ Layer authority.
2. Wait for kevis.online and hitch.guru transfer/delegation to settle.
3. Do not expose the unfinished Kevis app on the apex as the primary surface.
4. Use MJ-controlled authority/holding routing first.
5. Keep kevis-web Pages staged and available for previews.
6. Add Kevis/Hitch /mcp, /turn/*, and /audit/* routes to the master mj-edge once DNS is stable.
