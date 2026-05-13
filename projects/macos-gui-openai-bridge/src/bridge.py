#!/usr/bin/env python3
"""Compliant bridge for mapping local kits to OpenAI Responses API resources."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

OUTPUT_FORMATS = ("json", "dashboard")

API_BASE = "https://api.openai.com/v1"
MAX_KIT_BYTES = 1_000_000


class ValidationError(Exception):
    """Raised when a kit fails schema checks."""


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ValidationError(f"File not found: {path}")
    if path.stat().st_size > MAX_KIT_BYTES:
        raise ValidationError(f"Kit file exceeds {MAX_KIT_BYTES} bytes")
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


def validate_check_kit(payload: dict[str, Any]) -> None:
    require_fields(payload, ["name", "version", "checks"])
    checks = payload["checks"]
    if not isinstance(checks, list) or not checks:
        raise ValidationError("checks must be a non-empty list")


def post(path: str, body: dict[str, Any], api_key: str) -> dict[str, Any]:
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:  # nosec B310
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {details}") from exc


def build_agent_tools(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tools: list[dict[str, Any]] = payload.get("tools", [])
    if not isinstance(tools, list):
        raise ValidationError("tools must be a list when provided")
    for index, tool in enumerate(tools):
        if not isinstance(tool, dict):
            raise ValidationError(f"tools[{index}] must be an object")
    return tools


def build_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    metadata = payload.get("metadata", {})
    if not isinstance(metadata, dict):
        raise ValidationError("metadata must be an object when provided")
    return metadata


def print_result(result: dict[str, Any], output_format: str) -> None:
    if output_format == "dashboard":
        print("MJ Edge Dashboard")
        print("-" * 40)
        print(f"Response ID : {result.get("id", "n/a")}")
        output_text = result.get("output_text")
        if output_text:
            print(f"Output      : {output_text}")
        else:
            print("Output      : (empty)")
        return

    print(
        json.dumps(
            {
                "response_id": result.get("id"),
                "output_text": result.get("output_text"),
            },
            indent=2,
        )
    )


def push_agent(payload: dict[str, Any], api_key: str, store: bool, output_format: str) -> None:
    body: dict[str, Any] = {
        "model": payload["model"],
        "instructions": payload["instructions"],
        "input": payload.get("bootstrap_input", f"Initialize agent profile: {payload['name']}"),
        "tools": build_agent_tools(payload),
        "metadata": build_metadata(payload),
        "store": store,
    }
    result = post("/responses", body, api_key)
    print_result(result, output_format)


def push_thread(payload: dict[str, Any], api_key: str, store: bool, previous_response_id: str | None, output_format: str) -> None:
    messages = payload["messages"]
    conversation_input = [{"role": item["role"], "content": item["content"]} for item in messages]

    body: dict[str, Any] = {
        "model": payload.get("model", "gpt-5"),
        "input": conversation_input,
        "store": store,
    }
    if previous_response_id:
        body["previous_response_id"] = previous_response_id

    result = post("/responses", body, api_key)
    print_result(result, output_format)


def push_widget_kit(payload: dict[str, Any], api_key: str, store: bool, output_format: str) -> None:
    function_tool = {
        "type": "function",
        "name": "register_widget_kit",
        "description": "Register a widget kit manifest in backend deployment systems.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "version": {"type": "string"},
                "entrypoints": {"type": "object"},
            },
            "required": ["name", "version", "entrypoints"],
            "additionalProperties": False,
        },
    }

    body = {
        "model": payload.get("model", "gpt-5"),
        "input": (
            "Prepare registration arguments for this widget kit and call register_widget_kit with schema-valid JSON."
        ),
        "tools": [function_tool],
        "store": store,
        "metadata": build_metadata(payload),
    }
    result = post("/responses", body, api_key)
    print_result(result, output_format)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Codex/macOS to OpenAI API kit bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_cmd = subparsers.add_parser("validate")
    validate_cmd.add_argument("--kind", choices=["agent", "thread", "widget", "check"], required=True)
    validate_cmd.add_argument("--file", required=True)

    push_agent_cmd = subparsers.add_parser("push-agent")
    push_agent_cmd.add_argument("--file", required=True)
    push_agent_cmd.add_argument("--no-store", action="store_true")
    push_agent_cmd.add_argument("--output-format", choices=OUTPUT_FORMATS, default="dashboard")

    push_thread_cmd = subparsers.add_parser("push-thread")
    push_thread_cmd.add_argument("--file", required=True)
    push_thread_cmd.add_argument("--previous-response-id")
    push_thread_cmd.add_argument("--no-store", action="store_true")
    push_thread_cmd.add_argument("--output-format", choices=OUTPUT_FORMATS, default="dashboard")

    push_widget_cmd = subparsers.add_parser("push-widget")
    push_widget_cmd.add_argument("--file", required=True)
    push_widget_cmd.add_argument("--no-store", action="store_true")
    push_widget_cmd.add_argument("--output-format", choices=OUTPUT_FORMATS, default="dashboard")

    args = parser.parse_args(argv)
    payload = load_json(Path(args.file))

    if args.command == "validate":
        if args.kind == "agent":
            validate_agent_kit(payload)
        elif args.kind == "thread":
            validate_thread_kit(payload)
        elif args.kind == "check":
            validate_check_kit(payload)
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
        push_agent(payload, api_key, store=not args.no_store, output_format=args.output_format)
    elif args.command == "push-thread":
        validate_thread_kit(payload)
        push_thread(
            payload,
            api_key,
            store=not args.no_store,
            previous_response_id=args.previous_response_id,
            output_format=args.output_format,
        )
    elif args.command == "push-widget":
        validate_widget_kit(payload)
        push_widget_kit(payload, api_key, store=not args.no_store, output_format=args.output_format)

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
