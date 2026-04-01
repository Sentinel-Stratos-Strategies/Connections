# macOS GUI → OpenAI Platform Bridge (Project 1)

## Purpose

This project is the first implementation branch for the repository. It provides a **compliant starter workflow** for moving packaged "kit" artifacts from a Codex GUI/macOS environment into OpenAI API resources.

It is designed for:
- MacBook M3 environments running macOS Tahoe 26.4.
- Local preparation in Codex GUI.
- Explicit, API-key authenticated pushes into OpenAI API endpoints.

## What this project does (v0)

- Defines local JSON formats for:
  - custom agent kits,
  - widget kits (metadata + implementation refs),
  - chat thread kits (starter conversations and instructions).
- Provides a CLI script to:
  - validate kit files,
  - create an OpenAI assistant from an agent kit,
  - create a thread and seed it with messages from a chat thread kit.

## Compliance scope

This project intentionally supports only legal and permissible automation:

- Uses official OpenAI API authentication via `OPENAI_API_KEY`.
- Requires explicit user-triggered commands.
- Avoids any bypass patterns for app internals, hidden endpoints, or unauthorized data flows.
- Stores only user-provided metadata and messages.

## Current limitation (important)

The OpenAI "builder UI" (for directly managing ChatGPT-side builder artifacts) may have features that are **not currently exposed as public API endpoints**. Where direct API parity is unavailable, this bridge:

- captures kit intent as structured JSON, and
- maps supported parts into available API objects (assistants/threads).

## Quickstart

1. Export your API key:

```bash
export OPENAI_API_KEY="your_key_here"
```

2. Copy and customize templates in `kits/`.

3. Validate a kit:

```bash
python3 src/bridge.py validate --kind agent --file kits/agent-kit.example.json
```

4. Push an agent kit to create an assistant:

```bash
python3 src/bridge.py push-agent --file kits/agent-kit.example.json
```

5. Push a chat thread kit to create and seed a thread:

```bash
python3 src/bridge.py push-thread --file kits/chat-thread-kit.example.json
```

## Next milestones

- Add optional vector store wiring and file ingestion helper.
- Add MCP tunnel adapter contracts.
- Add widget deployment adapters for supported targets.


## Documentation-driven build track

For an OpenAI-docs-derived implementation map for Codex/Claude/CLI usage (agents, widget kits, check kits, MCP connectors, and backend push patterns), see:

- `projects/macos-gui-openai-bridge/OPENAI_BACKEND_SKILLSET.md`
- `skills/openai-platform-builder/SKILL.md`
- `templates/claude-codex-openai-workflow.md`
