#!/usr/bin/env python3
"""Local MJ Edge dashboard backend stub.

Serves:
- Static dashboard frontend files
- /api/tenants endpoint for monitoring data
- /api/events endpoint for live activity feed (mock)

This is intentionally lightweight for local integration and review.
"""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUTH_TOKEN = "mj-local-dev-token"

TENANTS = [
    {"tenant": "Hitch App", "owner": "ops@hitch.io", "plan": "Enterprise", "status": "active", "mrr": 1200, "lastSeen": "2m ago"},
    {"tenant": "Broverse Core", "owner": "admin@broverse.io", "plan": "Enterprise", "status": "active", "mrr": 2400, "lastSeen": "1m ago"},
    {"tenant": "Client Alpha", "owner": "owner@alpha.io", "plan": "Pro", "status": "watching", "mrr": 480, "lastSeen": "7m ago"},
    {"tenant": "Client Beta", "owner": "founder@beta.io", "plan": "Starter", "status": "building", "mrr": 120, "lastSeen": "13m ago"},
    {"tenant": "Dev Sandbox", "owner": "dev@sandbox.io", "plan": "Trial", "status": "trial", "mrr": 0, "lastSeen": "22m ago"},
]

EVENTS = [
    {"type": "deployment", "message": "Customer deployed latest build", "ts": "2026-05-13T00:00:00Z"},
    {"type": "billing", "message": "Renewal reminder sent", "ts": "2026-05-13T00:15:00Z"},
]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, payload: dict | list, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        header = self.headers.get("Authorization", "")
        return header == f"Bearer {AUTH_TOKEN}"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/tenants":
            if not self._authorized():
                self._json({"error": "unauthorized"}, status=HTTPStatus.UNAUTHORIZED)
                return
            self._json({"tenants": TENANTS})
            return

        if self.path == "/api/events":
            if not self._authorized():
                self._json({"error": "unauthorized"}, status=HTTPStatus.UNAUTHORIZED)
                return
            self._json({"events": EVENTS})
            return

        super().do_GET()


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    print("MJ Edge local server running on http://localhost:8080")
    print(f"Use Authorization: Bearer {AUTH_TOKEN}")
    server.serve_forever()


if __name__ == "__main__":
    main()
