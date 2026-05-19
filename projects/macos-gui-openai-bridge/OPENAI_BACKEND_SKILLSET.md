# OpenAI Backend Skillset (Codex / Claude / CLI)

_Last updated: April 1, 2026 (UTC)._

This guide translates official OpenAI documentation into a practical skillset for CLI-based builders who want to package and push custom agents, widget kits, check kits, and chat-thread kits into OpenAI-supported backend flows.

## 1) Capability map (from official docs)

### Agents and orchestration
- Agent Builder guide: workflow for building agentic systems and safety posture.
- Agents SDK guide: SDK-first multi-agent orchestration patterns.
- Responses API + tools: model execution surface for runtime agent calls.

### Kits and chat UX
- ChatKit guide: embeddable chat UX with OpenAI-hosted or advanced self-hosted modes.
- Advanced ChatKit integrations: custom backend wiring when not using default hosted flow.

### Retrieval + storage
- Retrieval guide and Vector Stores API: semantic search over uploaded files.
- File Search tool guide: attach vector stores as a tool in model runs.

### MCP connectors
- MCP integration guide: building remote MCP servers for ChatGPT/API workflows.
- Docs MCP page: official documentation MCP endpoint for Codex/IDE tooling.

## 2) Skill pack delivered in this repository

Use these assets:
- `skills/openai-platform-builder/SKILL.md`
- `projects/macos-gui-openai-bridge/src/bridge.py`
- `projects/macos-gui-openai-bridge/kits/*.json`
- `templates/claude-codex-openai-workflow.md`

## 3) Canonical workflow

1. Validate kit artifacts.
2. Push backend objects that have direct API parity now:
   - assistants (`/v1/assistants`)
   - threads + messages (`/v1/threads`, `/v1/threads/{id}/messages`)
3. Execute runtime tasks with Responses API (`/v1/responses`) using agent instructions + optional MCP tools.
4. Attach file search/vector store components as your knowledge layer.
5. Use ChatKit to deliver the frontend chat/widget experience.

## 4) CLI commands in this repo

```bash
python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind agent --file projects/macos-gui-openai-bridge/kits/agent-kit.example.json
python3 projects/macos-gui-openai-bridge/src/bridge.py push-agent --file projects/macos-gui-openai-bridge/kits/agent-kit.example.json
python3 projects/macos-gui-openai-bridge/src/bridge.py push-thread --file projects/macos-gui-openai-bridge/kits/chat-thread-kit.example.json
python3 projects/macos-gui-openai-bridge/src/bridge.py run-agent --file projects/macos-gui-openai-bridge/kits/agent-kit.example.json --input "Create a compliance checklist" --mcp-server-url "https://your-mcp-server.example.com"
```

## 5) Codex and Claude setup patterns

### Codex docs MCP
Use OpenAI's docs MCP server to keep API implementation aligned with current docs.

```bash
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
codex mcp list
```

### Claude or other CLI tools
Configure equivalent MCP server entries in that tool's MCP config format and point it to:

- `https://developers.openai.com/mcp`

Then use local skill/workflow templates in this repo.

## 6) Widget kits, check kits, and custom agents

- **Custom agents**: represented as agent kits and mapped to assistant creation + response runtime calls.
- **Widget kits**: represented as deployment metadata + entrypoints; implemented through ChatKit or custom frontend deployment adapters.
- **Check kits**: represent repeatable validation/eval rules; connect them to your CI checks and/or evaluation calls.

## 7) What can be pushed directly vs. modeled locally

Directly pushable via current bridge:
- assistant resources,
- thread resources,
- runtime response calls,
- optional MCP tool usage in responses calls.

Modeled locally pending fuller API parity:
- UI-builder-native kit assets that exist only in hosted builders.

## 8) Security and compliance requirements

- Use official OpenAI API keys and endpoint auth only.
- Prefer trusted MCP servers and verify ownership/hosting.
- Never use hidden/private endpoints or bypass platform controls.
- Do not attempt to retrieve deleted-account usage/login history unless explicitly authorized through official platform controls.
