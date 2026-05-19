-- MJ MCP Layer control plane schema

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic',
  status TEXT NOT NULL DEFAULT 'active',
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high')),
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'worker' CHECK (source IN ('worker', 'queue', 'api', 'schedule')),
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved')),
  description TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'queued', 'running', 'completed', 'failed')),
  result TEXT,
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  intent TEXT NOT NULL,
  requester TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
  policy_version TEXT,
  payload TEXT NOT NULL,
  receipt TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  decided_at TEXT,
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  intent TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cloudflare',
  hash TEXT NOT NULL,
  change_id TEXT,
  source TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('bootstrap', 'api', 'schedule', 'operator', 'automation')),
  payload TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure')),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_checks_kind ON checks(kind);
CREATE INDEX IF NOT EXISTS idx_ledger_intent ON ledger(intent);
CREATE INDEX IF NOT EXISTS idx_ledger_provider ON ledger(provider);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
