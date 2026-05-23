-- Migration: 0002_memory_contract.sql
-- Description: Add memory_entries table for project state persistence.

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  entry_value TEXT NOT NULL,
  metadata TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_tenant_key ON memory_entries(tenant_id, entry_key);
