/**
 * 通知模块 P0 生产库 DDL（TencentDB）
 */
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS overdraft_limit INT NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS short_name TEXT;

CREATE TABLE IF NOT EXISTS notification_templates (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  category TEXT NOT NULL,
  audience TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  requires_opt_out BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_code TEXT NOT NULL REFERENCES notification_templates(code),
  created_by TEXT NOT NULL REFERENCES users(id),
  audience_filter JSONB NOT NULL DEFAULT '{}',
  variable_overrides JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  sample_tested_at TIMESTAMPTZ,
  compliance_confirmed_by TEXT REFERENCES users(id),
  compliance_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_jobs_event_status_idx ON notification_jobs(event_id, status);

CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  scene TEXT NOT NULL,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS short_links_token_idx ON short_links(token);

CREATE TABLE IF NOT EXISTS notification_records (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES notification_jobs(id) ON DELETE SET NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_code TEXT NOT NULL REFERENCES notification_templates(code),
  channel TEXT NOT NULL,
  recipient_cipher TEXT NOT NULL,
  rendered_body TEXT NOT NULL,
  rendered_subject TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider_msg_id TEXT,
  error_code TEXT,
  short_link_id TEXT UNIQUE REFERENCES short_links(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_records_event_user_ch_idx ON notification_records(event_id, user_id, channel);
CREATE INDEX IF NOT EXISTS notification_records_job_status_idx ON notification_records(job_id, status);
CREATE INDEX IF NOT EXISTS notification_records_provider_idx ON notification_records(provider_msg_id);

CREATE TABLE IF NOT EXISTS optout_list (
  id TEXT PRIMARY KEY,
  identity_type TEXT NOT NULL,
  identity_value_hash TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'GLOBAL',
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS optout_list_lookup_idx ON optout_list(identity_type, identity_value_hash, scope, event_id);

CREATE TABLE IF NOT EXISTS notification_quota (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id, channel)
);
