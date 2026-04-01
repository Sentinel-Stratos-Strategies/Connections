# Branch Review (`work`)

## What is in this branch

This branch contains a small research/prototype repository named **Connections** focused on compliant integration workflows between Codex-style tooling and OpenAI APIs.

### Commit history summary

1. `bb202f3` — Initial commit.
2. `6e96ef5` — Added Project 1 scaffold for a macOS GUI → OpenAI bridge.
3. `c9d3068` — Added OpenAI docs-based skillset and MCP-enabled runtime workflow.
4. `1d9606f` — Merged README/repository-purpose PR.

### Current structure highlights

- `README.md` defines repository purpose, compliance boundaries, and current exploration track.
- `projects/macos-gui-openai-bridge/src/bridge.py` provides a CLI that:
  - validates local kit JSON files,
  - can create assistants,
  - can create threads + seed messages,
  - can run an agent via Responses API (optionally with an MCP server URL).
- `projects/macos-gui-openai-bridge/kits/*.example.json` provides sample kit inputs.
- `skills/openai-platform-builder/SKILL.md` documents an operator workflow around the bridge.

## Display: login/deleted-codex related references found

No account login history or deleted-account usage logs are present in this branch.

The only related items are policy statements and documentation constraints:

- `README.md` warns against exposing login histories or recovering deleted-environment records without official authorization.
- `skills/openai-platform-builder/SKILL.md` prohibits attempts to retrieve deleted-account logs or unauthorized login history.
- `projects/macos-gui-openai-bridge/OPENAI_BACKEND_SKILLSET.md` includes the same restriction.

## About “logins and past use of deleted codex”

I did **not** find any local login-history dump or recoverable deleted-account usage records in this branch.

Additionally, repository docs explicitly state that this repo should not be used to expose sensitive login history or recover usage records from deleted environments without official authorization/support.
