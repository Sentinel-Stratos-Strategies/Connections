# OpenAI Platform Builder Skill

## Goal

Provide an operational playbook for Codex CLI, Claude Code, or similar CLI tools to build and push:
- custom agents,
- widget kits,
- check kits,
- chat thread kits,
using official OpenAI API workflows and MCP-compatible connector patterns.

## Inputs

- `OPENAI_API_KEY`
- kit artifacts from `projects/macos-gui-openai-bridge/kits/`
- optional MCP server URL for tool connectivity

## Workflow

1. Validate kit files:
   - `python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind agent --file <agent-kit.json>`
   - `python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind thread --file <thread-kit.json>`
   - `python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind widget --file <widget-kit.json>`
2. Push supported backend resources:
   - Assistant: `push-agent`
   - Thread + messages: `push-thread`
3. Execute agent logic via Responses API (with optional MCP server):
   - `run-agent --input "<prompt>" [--mcp-server-url <url>]`
4. Store outputs and IDs in your CLI's task records.

## Expected outputs

- Assistant ID for custom-agent mapping
- Thread ID and seeded message count
- Response ID/status/output text for runtime validation

## Restrictions

- Use official API endpoints only.
- Never automate around hidden/internal endpoints.
- Never attempt to retrieve deleted-account logs or unauthorized login history.
