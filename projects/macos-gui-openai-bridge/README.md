# macOS GUI → OpenAI Platform Bridge (Project 1)

## Purpose

This project is the first implementation branch for the repository. It provides a **compliant starter workflow** for moving packaged "kit" artifacts from a Codex GUI/macOS environment into OpenAI API resources.

It is designed for:
- MacBook M3 environments running macOS Tahoe 26.4.
- Local preparation in Codex GUI.
- Explicit, API-key authenticated pushes into OpenAI API endpoints.

## What this project does (v1)

- Defines local JSON formats for:
  - custom agent kits,
  - widget kits,
  - check kits,
  - chat thread kits.
- Provides a CLI script to:
  - validate all kit files,
  - push agent kits through `responses.create`,
  - push chat thread kits through `responses.create` (with optional `previous_response_id`),
  - push widget kits using strict function-tool schemas.

## Compliance scope

This project intentionally supports only legal and permissible automation:

- Uses official OpenAI API authentication via `OPENAI_API_KEY`.
- Requires explicit user-triggered commands.
- Avoids bypass patterns for app internals, hidden endpoints, or unauthorized data flows.
- Stores only user-provided metadata and messages.

## Quickstart

1. Export your API key:

```bash
export OPENAI_API_KEY="your_key_here"
```

2. Validate kits:

```bash
python3 src/bridge.py validate --kind agent --file kits/agent-kit.example.json
python3 src/bridge.py validate --kind thread --file kits/chat-thread-kit.example.json
python3 src/bridge.py validate --kind widget --file kits/widget-kit.example.json
python3 src/bridge.py validate --kind check --file kits/check-kit.example.json
```

3. Push kits:

```bash
python3 src/bridge.py push-agent --file kits/agent-kit.example.json
python3 src/bridge.py push-thread --file kits/chat-thread-kit.example.json
python3 src/bridge.py push-widget --file kits/widget-kit.example.json
```

## Documentation bundle

Use the repository playbook for exhaustive workflow guidance:

- `docs/openai-skillset-playbook.md`
