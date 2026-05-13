# Local Models Lane — MJ MCP Connection Handoff

**Lane:** `mj-local-models`
**Platform:** Ollama (local) on Stratos_Tools
**Bridge endpoint:** `http://127.0.0.1:11437`
**MCP URL (for IDEs):** `http://127.0.0.1:11437`
**Health check:** `http://127.0.0.1:11437/healthz`
**Auth mode:** `mcp_connector` (no token required — localhost only)
**Data boundary:** Air-gapped. No external egress. Zero API cost.

---

## What This Lane Is

This is the **sovereign inference lane** for the Genesis project. Three trained personas run entirely on local hardware (Apple M3 Pro, Stratos_Tools volume) with no cloud dependency, no API key consumption, and no data leaving the machine.

The lane lives alongside every other MJ connector — Cloudflare, OpenAI, GitHub — but it is deliberately isolated. External read and external write are both `denied` at the policy level. This lane is a one-way street: operator sends a prompt, persona returns a response, audit log gets written locally.

---

## The Three Personas

| Persona | Model | Role |
|---------|-------|------|
| **Marvin** | `qwen3:latest` | Primary coding agent, architecture specialist, security strategist for ellis-aegis and Cloudflare. Trained on Genesis identity JSONL. Precise, ethical, first-principled. |
| **Harbor** | `mistral-nemo:latest` | Memory keeper and operator context holder for Sentinel (Joe Ellis). Direct, no sugar-coating, bro mode is real mode. Holds verified harbor_context.md. |
| **Dick Diggs** | `gemma3:4b` | Research and intelligence agent. Fast, thorough, source-grounded. Best for document analysis, data synthesis, log parsing. |

---

## Setup — One-Time

### 1. Start Ollama

```sh
OLLAMA_MODELS=/Volumes/Stratos_Tools/models \
  /Volumes/Stratos_Tools/homebrew/bin/ollama serve &
```

### 2. Pull the three models

```sh
OLLAMA_MODELS=/Volumes/Stratos_Tools/models \
  /Volumes/Stratos_Tools/homebrew/bin/ollama pull qwen3:latest

OLLAMA_MODELS=/Volumes/Stratos_Tools/models \
  /Volumes/Stratos_Tools/homebrew/bin/ollama pull mistral-nemo:latest

OLLAMA_MODELS=/Volumes/Stratos_Tools/models \
  /Volumes/Stratos_Tools/homebrew/bin/ollama pull gemma3:4b
```

### 3. Start the MJ bridge

```sh
cd /Volumes/Stratos_Tools/projects/Connections/projects/mj-mcp-layer/mcp-layer
npx ts-node src/local-models-bridge.ts
```

Or use the SENTINEL maintenance script:
```sh
/Volumes/SENTINEL/Scripts/local-models/start-bridge.sh
```

---

## IDE Connection (Zed / Cursor / Claude Desktop)

### Zed

In `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "mj-local-models": {
      "command": {
        "path": "/Volumes/Stratos_Tools/homebrew/bin/node",
        "args": [
          "/Volumes/Stratos_Tools/projects/Connections/projects/mj-mcp-layer/mcp-layer/src/local-models-bridge.ts"
        ],
        "env": {
          "OLLAMA_MODELS": "/Volumes/Stratos_Tools/models"
        }
      },
      "settings": {}
    }
  }
}
```

### Cursor

Add to MCP server list in Cursor settings:
```
Name: mj-local-models
URL:  http://127.0.0.1:11437
```

### Claude Desktop

In `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mj-local-models": {
      "command": "npx",
      "args": ["ts-node", "/Volumes/Stratos_Tools/projects/Connections/projects/mj-mcp-layer/mcp-layer/src/local-models-bridge.ts"],
      "env": { "OLLAMA_MODELS": "/Volumes/Stratos_Tools/models" }
    }
  }
}
```

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `marvin.infer` | Prompt Marvin (Qwen). Coding, architecture, Cloudflare, security. |
| `harbor.infer` | Prompt Harbor (Mistral Nemo). Operator context, memory, processing. |
| `diggs.infer` | Prompt Dick Diggs (Gemma). Research, document analysis, synthesis. |
| `persona.list` | List all personas and their assigned models. |
| `model.health` | Check which models are loaded in Ollama. |

---

## MJ Core Routing

When MJ Core receives a request that should go to a local persona, it routes to `mj-local-models` and dispatches the appropriate `persona.infer` action:

```json
{
  "actor": "operator",
  "source": "codex",
  "lane": "mj-local-models",
  "action": "marvin.infer",
  "resource": "local/ollama/qwen3",
  "payloadRef": "<request-id>",
  "risk": "low",
  "requiresApproval": false
}
```

Actions that **do** require approval: `model.pull`, `training.run`, `persona.context_overwrite`, `bridge.restart`.

---

## Data Boundaries

| Boundary | Value |
|----------|-------|
| External read | `denied` — no network calls out |
| External write | `denied` — no data leaves the machine |
| Truth write | `local_only` — audit log to SENTINEL/Logs |
| Secret handling | `never_return_secret_values` |
| Log payloads | `false` — prompts and responses are NOT logged |

---

## Connection to GENESIS:MEMORY

The local-models lane is the inference backbone for the **GENESIS:MEMORY** React Native app. When the app ships:

- Harbor handles personal memory queries (the `harbor.infer` tool)
- Marvin handles code generation and architecture tasks
- Diggs handles document and data lookups

The React Native app will connect to the bridge via a local network endpoint when on the same device/network, or via a WireGuard tunnel when remote.

---

## Training Context Files

| Persona | Context File | Format |
|---------|-------------|--------|
| Marvin | `/Volumes/SENTINEL/Recovered/RESCUE_OS_20260511/AgentWork/training/data/final/marvin_qwen_identity.jsonl` | JSONL (instruction/output pairs) |
| Harbor | `/Volumes/RESCUE_OS/memory/harbor_context.md` + `harbor_memory.json` | Markdown + JSON |
| Dick Diggs | None yet — add at `/Volumes/Stratos_Tools/data/diggs_context.md` | Markdown |

---

## Audit Trail

All inference calls emit a lightweight audit record to:
```
/Volumes/SENTINEL/Logs/local-models-bridge/bridge-YYYY-MM-DD.jsonl
```

Payloads are NOT logged. Only: timestamp, request ID, tool name, persona, model, action (start/complete/error), response length.

---

## Blockers Before Going Live

1. **Models not yet pulled** — run the pull commands above once Ollama is confirmed running
2. **Harbor context file** may need to be refreshed from `/Volumes/RESCUE_OS/memory/` — that volume access is slow
3. **ts-node** must be available: `npm install -g ts-node typescript` (or use the Stratos_Tools homebrew Node)
4. **GENESIS:MEMORY** React Native app not complete — bridge is ready, app shell needs to be wired up
