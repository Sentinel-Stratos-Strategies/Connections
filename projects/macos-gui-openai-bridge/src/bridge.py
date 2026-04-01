#!/usr/bin/env python3
"""Compliant bridge for mapping local kits to OpenAI API resources."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API_BASE = "https://api.openai.com/v1"


class ValidationError(Exception):
    """Raised when a kit fails schema checks."""


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValidationError("Top-level JSON must be an object")
    return data


def require_fields(payload: dict[str, Any], fields: list[str]) -> None:
    missing = [field for field in fields if field not in payload]
    if missing:
        raise ValidationError(f"Missing required field(s): {', '.join(missing)}")


def validate_agent_kit(payload: dict[str, Any]) -> None:
    require_fields(payload, ["name", "model", "instructions"])


def validate_thread_kit(payload: dict[str, Any]) -> None:
    require_fields(payload, ["messages"])
    messages = payload["messages"]
    if not isinstance(messages, list) or not messages:
        raise ValidationError("messages must be a non-empty list")
    for index, item in enumerate(messages):
        if not isinstance(item, dict):
            raise ValidationError(f"messages[{index}] must be an object")
        require_fields(item, ["role", "content"])


def validate_widget_kit(payload: dict[str, Any]) -> None:
    require_fields(payload, ["name", "version", "entrypoints"])


def request(path: str, body: dict[str, Any], api_key: str, method: str = "POST") -> dict[str, Any]:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {details}") from exc


def push_agent(payload: dict[str, Any], api_key: str) -> None:
    body = {
        "name": payload["name"],
        "model": payload["model"],
        "instructions": payload["instructions"],
        "tools": payload.get("tools", []),
        "metadata": payload.get("metadata", {}),
    }
    result = request("/assistants", body, api_key)
    print(json.dumps({"assistant_id": result.get("id")}, indent=2))


def push_thread(payload: dict[str, Any], api_key: str) -> None:
    thread = request("/threads", {}, api_key)
    thread_id = thread.get("id")
    if not thread_id:
        raise RuntimeError("Thread creation did not return an id")

    for message in payload["messages"]:
        request(
            f"/threads/{thread_id}/messages",
            {"role": message["role"], "content": message["content"]},
            api_key,
        )

    print(json.dumps({"thread_id": thread_id, "message_count": len(payload["messages"])}, indent=2))


def run_response(payload: dict[str, Any], api_key: str, user_input: str, mcp_server_url: str | None) -> None:
    tools: list[dict[str, Any]] = payload.get("tools", [])
    if mcp_server_url:
        tools.append(
            {
                "type": "mcp",
                "server_label": payload.get("name", "kit_mcp").replace(" ", "_").lower(),
                "server_url": mcp_server_url,
                "allowed_tools": ["search", "fetch"],
                "require_approval": "never",
            }
        )

    body = {
        "model": payload["model"],
        "instructions": payload["instructions"],
        "input": user_input,
        "tools": tools,
    }
    result = request("/responses", body, api_key)
    print(
        json.dumps(
            {
                "response_id": result.get("id"),
                "status": result.get("status"),
                "output_text": result.get("output_text"),
            },
            indent=2,
        )
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Codex/macOS to OpenAI API kit bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_cmd = subparsers.add_parser("validate")
    validate_cmd.add_argument("--kind", choices=["agent", "thread", "widget"], required=True)
    validate_cmd.add_argument("--file", required=True)

    push_agent_cmd = subparsers.add_parser("push-agent")
    push_agent_cmd.add_argument("--file", required=True)

    push_thread_cmd = subparsers.add_parser("push-thread")
    push_thread_cmd.add_argument("--file", required=True)

    run_cmd = subparsers.add_parser("run-agent")
    run_cmd.add_argument("--file", required=True)
    run_cmd.add_argument("--input", required=True)
    run_cmd.add_argument("--mcp-server-url", required=False)

    args = parser.parse_args(argv)
    payload = load_json(Path(args.file))

    if args.command == "validate":
        if args.kind == "agent":
            validate_agent_kit(payload)
        elif args.kind == "thread":
            validate_thread_kit(payload)
        else:
            validate_widget_kit(payload)
        print("Validation successful")
        return 0

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is required for push commands", file=sys.stderr)
        return 2

    if args.command == "push-agent":
        validate_agent_kit(payload)
        push_agent(payload, api_key)
    elif args.command == "push-thread":
        validate_thread_kit(payload)
        push_thread(payload, api_key)
    elif args.command == "run-agent":
        validate_agent_kit(payload)
        run_response(payload, api_key, args.input, args.mcp_server_url)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except ValidationError as exc:
        print(f"Validation error: {exc}", file=sys.stderr)
        raise SystemExit(1)
    except RuntimeError as exc:
        print(f"Runtime error: {exc}", file=sys.stderr)
        raise SystemExit(1)
