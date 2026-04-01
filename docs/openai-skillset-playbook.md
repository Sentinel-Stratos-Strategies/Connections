# OpenAI Skillset Playbook for Codex / Claude Code / CLI Tools

## Objective

Define a practical, documentation-grounded skillset for building and pushing:

- custom agents,
- widget kits,
- check kits,
- chat thread kits,

into OpenAI-supported backend primitives using official APIs and MCP connectors.

## Canonical OpenAI documentation used

- Responses API (core generation + tool orchestration):
  - https://platform.openai.com/docs/api-reference/responses/create
- MCP with OpenAI docs and Codex CLI quickstart:
  - https://developers.openai.com/learn/docs-mcp
- Tools guides index (built-in + remote MCP + function tools):
  - https://platform.openai.com/docs/guides/tools
- File Search guide:
  - https://platform.openai.com/docs/guides/tools-file-search

## Skillset architecture

### 1) Kit authoring skill

Use JSON kits as source-of-truth artifacts in version control:

- `agent-kit`: model + instructions + tools + metadata.
- `chat-thread-kit`: structured conversation seeds.
- `widget-kit`: deployment metadata and entrypoints.
- `check-kit`: policy/reliability checks for downstream pipelines.

### 2) Validation skill

Validate kit shape before API calls.

Implemented in:
- `projects/macos-gui-openai-bridge/src/bridge.py`

Commands:

```bash
python3 src/bridge.py validate --kind agent --file kits/agent-kit.example.json
python3 src/bridge.py validate --kind thread --file kits/chat-thread-kit.example.json
python3 src/bridge.py validate --kind widget --file kits/widget-kit.example.json
python3 src/bridge.py validate --kind check --file kits/check-kit.example.json
```

### 3) Push skill (OpenAI backend)

Use Responses API as primary write path:

- `push-agent`: starts a stored response using model/instructions/tool config.
- `push-thread`: pushes seeded messages with optional `previous_response_id` chaining.
- `push-widget`: maps widget kit registration to a strict function tool schema.

Commands:

```bash
python3 src/bridge.py push-agent --file kits/agent-kit.example.json
python3 src/bridge.py push-thread --file kits/chat-thread-kit.example.json
python3 src/bridge.py push-widget --file kits/widget-kit.example.json
```

### 4) MCP connector skill

For Codex CLI environments, configure MCP connectors for external systems and docs sources:

```bash
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
codex mcp list
```

Then expose connector-backed operations through tools in kit definitions (for example via `type: "mcp"` tools where supported in your selected API flow).

## CLI portability guidance (Codex / Claude Code / other)

- Keep kits tool-agnostic JSON.
- Keep push logic in one bridge CLI (`bridge.py`) so different terminal agents can invoke same workflow.
- Keep secrets in environment variables only.
- Keep an auditable command log in shell history/CI logs.

## Compliance and data handling boundaries

- Use only officially documented API endpoints.
- No hidden/private builder UI endpoints.
- Require explicit authenticated calls and local user intent.
- Do not attempt to retrieve login history or usage from deleted Codex environments unless officially exposed and authorized by platform controls.
