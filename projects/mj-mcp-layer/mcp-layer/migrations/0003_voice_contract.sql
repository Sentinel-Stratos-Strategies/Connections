-- Migration: 0003_voice_contract.sql
-- Description: Add voice_profiles table for project voice configuration.

CREATE TABLE IF NOT EXISTS voice_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  model TEXT NOT NULL,
  metadata TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_tenant_name ON voice_profiles(tenant_id, profile_name);
