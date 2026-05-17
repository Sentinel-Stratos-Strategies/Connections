# MJ Layer — manifest index (Connections)

## Sentinel volume reference (mirrored)

Snapshots from **`/Volumes/SENTINEL`** for audits and migration context:

- [references/sentinel-volume/MANIFEST_INDEX.md](references/sentinel-volume/MANIFEST_INDEX.md)

## Routing & zones (authoritative for `mj-edge`)

- [cloudflare/manifests/mj-edge-routing.yaml](../cloudflare/manifests/mj-edge-routing.yaml)
- [manifests/zones/hitch.guru.yaml](../manifests/zones/hitch.guru.yaml)
- [manifests/zones/kevis.online.yaml](../manifests/zones/kevis.online.yaml)

## Tenants & policy

- [manifests/tenants/hitch.yaml](../manifests/tenants/hitch.yaml)
- [manifests/tenants/kevis.yaml](../manifests/tenants/kevis.yaml)
- [manifests/policies/mj-edge-unified-v2.yaml](../manifests/policies/mj-edge-unified-v2.yaml)

## Connections catalog

- [../../mj-mcp/connections/infrastructure-connections.json](../../mj-mcp/connections/infrastructure-connections.json)

## Deployment / compliance helpers

- [manifests/deployment/deployment-manifest.schema.json](../manifests/deployment/deployment-manifest.schema.json)
- [manifests/deployment/deployment-manifest.example.json](../manifests/deployment/deployment-manifest.example.json)
- [manifests/compliance/soc2.yaml](../manifests/compliance/soc2.yaml)
- [manifests/budgets/](../manifests/budgets/) (operator, codex, cursor, local-models)
- [platform/manifests/unified-security-v1.yaml](../platform/manifests/unified-security-v1.yaml)

## Ellis Aegis / MUA / enterprise (sibling repo)

Cloudflare Worker substrate, hardening scripts, and `mj-enterprise-ops` live in **Cloudflare-ellis-aegis** — see its `docs/MANIFEST_INDEX.md`.
