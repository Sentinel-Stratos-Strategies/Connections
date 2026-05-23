-- Migration: 0004_notifications.sql
-- Description: Add notification_subscriptions table.

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL, -- e.g. "expo"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_tenant ON notification_subscriptions(tenant_id);
