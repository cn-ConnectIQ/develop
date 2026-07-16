import { prisma } from "@connectiq/database";

/** 通知模块 P0 表结构 + 枚举（生产 TencentDB 可重复执行） */
export const NOTIFICATION_SCHEMA_STATEMENTS: string[] = [
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS overdraft_limit INT NOT NULL DEFAULT 0`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS short_name TEXT`,
  `DO $$ BEGIN
     CREATE TYPE "OutboundChannel" AS ENUM ('SMS', 'EMAIL', 'WECHAT');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "NotificationCategory" AS ENUM ('VERIFY', 'TRANSACTIONAL', 'MARKETING');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "NotificationAudience" AS ENUM ('ATTENDEE', 'EXHIBITOR', 'ORGANIZER', 'STAFF');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "NotificationJobStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'DONE', 'FAILED', 'CANCELLED');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "NotificationRecordStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "ShortLinkScene" AS ENUM ('A', 'B', 'O', 'J');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "OptOutScope" AS ENUM ('GLOBAL', 'EVENT');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE "OptOutSource" AS ENUM ('SMS_REPLY', 'EMAIL_LINK', 'MANUAL');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `CREATE TABLE IF NOT EXISTS notification_templates (
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
  )`,
  `CREATE TABLE IF NOT EXISTS notification_jobs (
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
  )`,
  `CREATE INDEX IF NOT EXISTS notification_jobs_event_status_idx ON notification_jobs(event_id, status)`,
  `CREATE TABLE IF NOT EXISTS short_links (
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
  )`,
  `CREATE INDEX IF NOT EXISTS short_links_token_idx ON short_links(token)`,
  `CREATE TABLE IF NOT EXISTS notification_records (
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
  )`,
  `CREATE INDEX IF NOT EXISTS notification_records_event_user_ch_idx ON notification_records(event_id, user_id, channel)`,
  `CREATE INDEX IF NOT EXISTS notification_records_job_status_idx ON notification_records(job_id, status)`,
  `CREATE INDEX IF NOT EXISTS notification_records_provider_idx ON notification_records(provider_msg_id)`,
  `CREATE TABLE IF NOT EXISTS optout_list (
    id TEXT PRIMARY KEY,
    identity_type TEXT NOT NULL,
    identity_value_hash TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'GLOBAL',
    event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS optout_list_lookup_idx ON optout_list(identity_type, identity_value_hash, scope, event_id)`,
  `CREATE TABLE IF NOT EXISTS notification_quota (
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id, channel)
  )`,
];

/** TEXT → PG 枚举（表已存在时幂等；失败则忽略） */
export const NOTIFICATION_ENUM_ALTER_STATEMENTS: string[] = [
  `ALTER TABLE notification_templates
     ALTER COLUMN channel TYPE "OutboundChannel" USING channel::"OutboundChannel",
     ALTER COLUMN category TYPE "NotificationCategory" USING category::"NotificationCategory",
     ALTER COLUMN audience TYPE "NotificationAudience" USING audience::"NotificationAudience"`,
  `ALTER TABLE notification_jobs
     ALTER COLUMN status TYPE "NotificationJobStatus" USING status::"NotificationJobStatus"`,
  `ALTER TABLE notification_records
     ALTER COLUMN channel TYPE "OutboundChannel" USING channel::"OutboundChannel",
     ALTER COLUMN status TYPE "NotificationRecordStatus" USING status::"NotificationRecordStatus"`,
  `ALTER TABLE short_links
     ALTER COLUMN scene TYPE "ShortLinkScene" USING scene::"ShortLinkScene"`,
  `ALTER TABLE optout_list
     ALTER COLUMN scope TYPE "OptOutScope" USING scope::"OptOutScope",
     ALTER COLUMN source TYPE "OptOutSource" USING source::"OptOutSource"`,
  `ALTER TABLE notification_quota
     ALTER COLUMN channel TYPE "OutboundChannel" USING channel::"OutboundChannel"`,
];

export const NOTIFICATION_CUSTOM_TEMPLATE_SEED = `
INSERT INTO notification_templates (
  code, name, channel, category, audience, subject, body, variables,
  requires_opt_out, enabled, created_at, updated_at
) VALUES
  (
    'CUSTOM-SMS',
    '自定义短信通知',
    'SMS',
    'MARKETING',
    'ATTENDEE',
    NULL,
    '【玖莅】{内容} 回T退订',
    '["内容"]'::jsonb,
    true, true, NOW(), NOW()
  ),
  (
    'CUSTOM-EMAIL',
    '自定义邮件通知',
    'EMAIL',
    'MARKETING',
    'ATTENDEE',
    '{主题}',
    E'{姓氏称谓}，您好。\\n\\n{内容}\\n\\n——\\n{活动全称}',
    '["姓氏称谓","主题","内容","活动全称"]'::jsonb,
    false, true, NOW(), NOW()
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  subject = EXCLUDED.subject,
  variables = EXCLUDED.variables,
  enabled = true,
  updated_at = NOW()
`;

export async function applyNotificationSchemaSync(): Promise<{
  applied: string[];
  enumAlterSkipped: string[];
}> {
  const applied: string[] = [];
  const enumAlterSkipped: string[] = [];

  for (const sql of NOTIFICATION_SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    applied.push(sql.slice(0, 80));
  }

  for (const sql of NOTIFICATION_ENUM_ALTER_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      applied.push(`enum: ${sql.slice(0, 60)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      enumAlterSkipped.push(msg.slice(0, 120));
    }
  }

  await prisma.$executeRawUnsafe(NOTIFICATION_CUSTOM_TEMPLATE_SEED);
  applied.push("seed: CUSTOM-SMS / CUSTOM-EMAIL");

  return { applied, enumAlterSkipped };
}

export async function probeNotificationSchema(): Promise<"ok" | string> {
  try {
    await prisma.notificationJob.findFirst({
      select: { id: true, status: true },
      take: 1,
    });
    return "ok";
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 240) : "unknown";
  }
}
