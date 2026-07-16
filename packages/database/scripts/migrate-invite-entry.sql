/**
 * 受邀入口 InviteEntry 生产库 DDL
 * phone 可空 = 活动通用码；name 可选显示名
 */
DO $$ BEGIN
  CREATE TYPE "InviteEntryStatus" AS ENUM ('PENDING', 'USED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS invite_entries (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phone TEXT,
  honorific TEXT,
  name TEXT,
  participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
  status "InviteEntryStatus" NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 若表已存在：放宽 phone、补 name
ALTER TABLE invite_entries ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE invite_entries ADD COLUMN IF NOT EXISTS name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS invite_entries_token_key ON invite_entries(token);
CREATE INDEX IF NOT EXISTS invite_entries_event_phone_status_idx
  ON invite_entries(event_id, phone, status);
CREATE INDEX IF NOT EXISTS invite_entries_event_status_idx
  ON invite_entries(event_id, status);
CREATE INDEX IF NOT EXISTS invite_entries_status_expires_idx
  ON invite_entries(status, expires_at);
