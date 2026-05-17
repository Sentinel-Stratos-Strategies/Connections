# Sentinel volume manifest index

Mirrored from **`/Volumes/SENTINEL`** for MJ Layer connections, lane handoffs, and operator audits.  
These files are **reference snapshots** only.

## Volume inventories (`inventories/`)

| File | Source on Sentinel | Description |
|------|-------------------|-------------|
| `Stratos_Tools_dirs_depth3_20260511.txt` | `Manifests/Stratos_Tools_dirs_depth3_20260511.txt` | Depth-3 directory listing under Stratos_Tools (2026-05-11). |
| `OS_BOOT_top_level_20260511.txt` | `Manifests/OS_BOOT_top_level_20260511.txt` | Boot volume top-level listing snapshot. |
| `pre_copy_space_20260511.txt` | `Manifests/pre_copy_space_20260511.txt` | Pre-copy space note / minimal manifest. |
| `RESCUE_OS_top_level_20260511.txt` | `Manifests/RESCUE_OS_top_level_20260511.txt` | Rescue OS volume top-level listing. |
| `RESCUE_OS_dirs_depth2_20260511.txt` | `Manifests/RESCUE_OS_dirs_depth2_20260511.txt` | Rescue OS depth-2 directory listing. |

### Full Rescue OS filelist (not vendored)

| Logical name | Source on Sentinel | Notes |
|----------------|-------------------|--------|
| `RESCUE_OS_full_filelist_20260511.txt` | `Manifests/RESCUE_OS_full_filelist_20260511.txt` | **~65 MB**. Kept **only** on Sentinel. See `inventories/RESCUE_OS_full_filelist.SOURCE_NOTE.txt`. |

## Strat-tools manifests (`strat-tools/`)

| File | Source on Sentinel | Description |
|------|-------------------|-------------|
| `REPOS.txt` | `AgentWork/strat-tools/REPOS.txt` | Curated git roots for Sentinel → Stratos migration planning. |
| `sentinel-iphone13-harbor/STRATOS_BUILD_MANIFEST.json` | `…/STRATOS_BUILD_MANIFEST.json` | Harbor / iPhone 13 tether build manifest. |
| `sentinel-iphone13-harbor/shortcuts/DEPLOY_MANIFEST.json` | `…/shortcuts/DEPLOY_MANIFEST.json` | Shortcut deploy manifest (generation-time IPs). |

## MJ Layer manifests in this repo (authoritative for routing)

- `projects/mj-mcp-layer/cloudflare/manifests/mj-edge-routing.yaml`
- `projects/mj-mcp-layer/manifests/zones/*.yaml`
- `projects/mj-mcp-layer/manifests/tenants/*.yaml`
- `projects/mj-mcp-layer/manifests/policies/mj-edge-unified-v2.yaml`
- `projects/mj-mcp/connections/infrastructure-connections.json`

Parallel Ellis Aegis / MUA / enterprise manifests live in the **Cloudflare-ellis-aegis** repo (`docs/MANIFEST_INDEX.md`).

## Tools & automation catalog (Connections)

- [**`PROJECT_TOOL_MANIFEST.md`**](../PROJECT_TOOL_MANIFEST.md)
- [`manifests/catalog/project-tools.yaml`](../../../manifests/catalog/project-tools.yaml)
