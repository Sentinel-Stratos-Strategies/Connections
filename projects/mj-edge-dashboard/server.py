#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("MJ_DB_PATH", ROOT / "mj_edge.db"))
ALLOWED_ORIGIN = os.getenv("MJ_ALLOWED_ORIGIN", "http://localhost:8080")
TOKEN_TTL_SECONDS = int(os.getenv("MJ_TOKEN_TTL_SECONDS", "28800"))

SEED_USERS = [
    ("admin@mj.local", "admin123", "admin", None),
    ("owner@alpha.io", "alpha123", "customer", "Client Alpha"),
]
RATE_BUCKET: dict[str, list[float]] = {}
TOKENS: dict[str, dict[str, str | float | None]] = {}


def hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return digest.hex()


def check_rate_limit(ip: str, limit: int = 60, window_seconds: int = 60) -> bool:
    now = time.time()
    bucket = [t for t in RATE_BUCKET.get(ip, []) if now - t < window_seconds]
    bucket.append(now)
    RATE_BUCKET[ip] = bucket
    return len(bucket) <= limit


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = db()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','customer')),
            tenant_scope TEXT
        );
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant TEXT UNIQUE NOT NULL,
            owner TEXT NOT NULL,
            plan TEXT NOT NULL,
            status TEXT NOT NULL,
            mrr INTEGER NOT NULL,
            last_seen TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant TEXT,
            message TEXT NOT NULL,
            ts TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor TEXT,
            action TEXT NOT NULL,
            path TEXT NOT NULL,
            ts INTEGER NOT NULL,
            metadata TEXT
        );
        """
    )
    for email, password, role, scope in SEED_USERS:
        salt = secrets.token_hex(16)
        pwd_hash = hash_password(password, salt)
        cur.execute(
            "INSERT OR IGNORE INTO users(email,password_hash,password_salt,role,tenant_scope) VALUES(?,?,?,?,?)",
            (email, pwd_hash, salt, role, scope),
        )
    cur.execute("SELECT COUNT(*) AS c FROM tenants")
    if cur.fetchone()["c"] == 0:
        cur.executemany(
            "INSERT INTO tenants(tenant,owner,plan,status,mrr,last_seen) VALUES(?,?,?,?,?,?)",
            [
                ("Hitch App", "ops@hitch.io", "Enterprise", "active", 1200, "2m ago"),
                ("Broverse Core", "admin@broverse.io", "Enterprise", "active", 2400, "1m ago"),
                ("Client Alpha", "owner@alpha.io", "Pro", "watching", 480, "7m ago"),
                ("Client Beta", "founder@beta.io", "Starter", "building", 120, "13m ago"),
            ],
        )
    cur.execute("SELECT COUNT(*) AS c FROM events")
    if cur.fetchone()["c"] == 0:
        cur.executemany(
            "INSERT INTO events(tenant,message,ts) VALUES(?,?,?)",
            [
                ("Client Alpha", "Deployment queued", "2026-05-13T00:00:00Z"),
                ("Broverse Core", "Billing webhook healthy", "2026-05-13T00:15:00Z"),
            ],
        )
    conn.commit()
    conn.close()


def log_audit(actor: str | None, action: str, path: str, metadata: dict | None = None) -> None:
    conn = db()
    conn.execute(
        "INSERT INTO audit_logs(actor,action,path,ts,metadata) VALUES(?,?,?,?,?)",
        (actor, action, path, int(time.time()), json.dumps(metadata or {})),
    )
    conn.commit()
    conn.close()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token")
        self.end_headers()

    def _json(self, payload: dict | list, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _principal(self):
        header = self.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.split(" ", 1)[1]
        p = TOKENS.get(token)
        if not p:
            return None
        if time.time() > float(p["exp"]):
            TOKENS.pop(token, None)
            return None
        return p

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _enforce_csrf(self):
        if self.command != "POST":
            return True
        token = self.headers.get("X-CSRF-Token")
        return bool(token and len(token) >= 8)

    def do_POST(self):  # noqa: N802
        if not check_rate_limit(self.client_address[0]):
            self._json({"error": "rate_limited"}, status=HTTPStatus.TOO_MANY_REQUESTS)
            return
        if not self._enforce_csrf() and self.path != "/api/login":
            self._json({"error": "csrf_required"}, status=HTTPStatus.FORBIDDEN)
            return

        if self.path == "/api/login":
            payload = self._read_json()
            email = payload.get("email", "")
            password = payload.get("password", "")
            conn = db()
            row = conn.execute(
                "SELECT email, role, tenant_scope, password_hash, password_salt FROM users WHERE email=?",
                (email,),
            ).fetchone()
            conn.close()
            if not row:
                log_audit(email, "login_failed", self.path)
                self._json({"error": "invalid_credentials"}, status=HTTPStatus.UNAUTHORIZED)
                return
            test_hash = hash_password(password, row["password_salt"])
            if not hmac.compare_digest(test_hash, row["password_hash"]):
                log_audit(email, "login_failed", self.path)
                self._json({"error": "invalid_credentials"}, status=HTTPStatus.UNAUTHORIZED)
                return
            token = secrets.token_urlsafe(24)
            TOKENS[token] = {
                "email": row["email"],
                "role": row["role"],
                "tenant_scope": row["tenant_scope"],
                "exp": time.time() + TOKEN_TTL_SECONDS,
            }
            log_audit(row["email"], "login_success", self.path)
            self._json({"token": token, "role": row["role"], "tenant_scope": row["tenant_scope"], "csrf": secrets.token_urlsafe(12)})
            return

        self._json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)

    def do_GET(self):  # noqa: N802
        if self.path == "/healthz":
            self._json({"status": "ok"})
            return

        if self.path.startswith("/api/"):
            if not check_rate_limit(self.client_address[0]):
                self._json({"error": "rate_limited"}, status=HTTPStatus.TOO_MANY_REQUESTS)
                return
            principal = self._principal()
            if not principal:
                self._json({"error": "unauthorized"}, status=HTTPStatus.UNAUTHORIZED)
                return

            if self.path.startswith("/api/tenants"):
                parsed = urlparse(self.path)
                q = parse_qs(parsed.query)
                search = q.get("q", [""])[0]
                conn = db()
                if principal["role"] == "admin":
                    rows = conn.execute(
                        "SELECT tenant,owner,plan,status,mrr,last_seen AS lastSeen FROM tenants WHERE tenant LIKE ? OR owner LIKE ? OR plan LIKE ?",
                        (f"%{search}%", f"%{search}%", f"%{search}%"),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT tenant,owner,plan,status,mrr,last_seen AS lastSeen FROM tenants WHERE tenant = ?",
                        (principal["tenant_scope"],),
                    ).fetchall()
                conn.close()
                log_audit(principal["email"], "read_tenants", self.path)
                self._json({"tenants": [dict(r) for r in rows], "role": principal["role"]})
                return

            if self.path == "/api/events":
                conn = db()
                if principal["role"] == "admin":
                    rows = conn.execute("SELECT tenant, message, ts FROM events ORDER BY id DESC LIMIT 50").fetchall()
                else:
                    rows = conn.execute(
                        "SELECT tenant, message, ts FROM events WHERE tenant = ? ORDER BY id DESC LIMIT 50",
                        (principal["tenant_scope"],),
                    ).fetchall()
                conn.close()
                log_audit(principal["email"], "read_events", self.path)
                self._json({"events": [dict(r) for r in rows], "role": principal["role"]})
                return

            if self.path == "/api/audit":
                if principal["role"] != "admin":
                    self._json({"error": "forbidden"}, status=HTTPStatus.FORBIDDEN)
                    return
                conn = db()
                rows = conn.execute("SELECT actor, action, path, ts, metadata FROM audit_logs ORDER BY id DESC LIMIT 500").fetchall()
                conn.close()
                self._json({"audit": [dict(r) for r in rows]})
                return

            if self.path == "/api/audit.csv":
                if principal["role"] != "admin":
                    self._json({"error": "forbidden"}, status=HTTPStatus.FORBIDDEN)
                    return
                conn = db()
                rows = conn.execute("SELECT actor, action, path, ts, metadata FROM audit_logs ORDER BY id DESC LIMIT 1000").fetchall()
                conn.close()
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(["actor", "action", "path", "ts", "metadata"])
                for r in rows:
                    writer.writerow([r["actor"], r["action"], r["path"], r["ts"], r["metadata"]])
                data = buf.getvalue().encode("utf-8")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/csv")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

            self._json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return

        super().do_GET()


def main() -> None:
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    print("MJ Edge local server running on http://localhost:8080")
    server.serve_forever()


if __name__ == "__main__":
    main()
