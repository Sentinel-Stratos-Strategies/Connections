# Codex / Claude CLI OpenAI Workflow Template

## Step 1: Environment

```bash
export OPENAI_API_KEY="..."
```

## Step 2: Validate kits

```bash
python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind agent --file projects/macos-gui-openai-bridge/kits/agent-kit.example.json
python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind thread --file projects/macos-gui-openai-bridge/kits/chat-thread-kit.example.json
python3 projects/macos-gui-openai-bridge/src/bridge.py validate --kind widget --file projects/macos-gui-openai-bridge/kits/widget-kit.example.json
```

## Step 3: Push to OpenAI backend

```bash
python3 projects/macos-gui-openai-bridge/src/bridge.py push-agent --file projects/macos-gui-openai-bridge/kits/agent-kit.example.json
python3 projects/macos-gui-openai-bridge/src/bridge.py push-thread --file projects/macos-gui-openai-bridge/kits/chat-thread-kit.example.json
```

## Step 4: Run agent with optional MCP connector

```bash
python3 projects/macos-gui-openai-bridge/src/bridge.py run-agent \
  --file projects/macos-gui-openai-bridge/kits/agent-kit.example.json \
  --input "Create a release readiness checklist" \
  --mcp-server-url "https://your-mcp-server.example.com"
```
