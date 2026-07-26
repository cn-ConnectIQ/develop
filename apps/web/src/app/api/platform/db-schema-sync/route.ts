import { prisma } from "@connectiq/database";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  applyNotificationSchemaSync,
  probeNotificationSchema,
} from "@/lib/db/notification-schema-sync";
import { ErrorCode } from "@connectiq/types";

/**
 * 一次性 / 可重复：补齐代码已依赖但生产库未执行的列与表。
 * 仅平台管理员可调用。
 */
export const POST = withErrorHandler(async () => {
  await requirePlatformAdmin();

  const statements = [
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS overdraft_limit INT NOT NULL DEFAULT 0`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS short_name TEXT`,
    `DO $$ BEGIN
       CREATE TYPE "InviteEntryStatus" AS ENUM ('PENDING', 'USED', 'REVOKED');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`,
    `CREATE TABLE IF NOT EXISTS invite_entries (
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
     )`,
    `ALTER TABLE invite_entries ALTER COLUMN phone DROP NOT NULL`,
    `ALTER TABLE invite_entries ADD COLUMN IF NOT EXISTS name TEXT`,
    `CREATE INDEX IF NOT EXISTS invite_entries_event_phone_status_idx ON invite_entries(event_id, phone, status)`,
    `CREATE INDEX IF NOT EXISTS invite_entries_event_status_idx ON invite_entries(event_id, status)`,
    `CREATE INDEX IF NOT EXISTS invite_entries_status_expires_idx ON invite_entries(status, expires_at)`,
    // 通用伙伴参会人员同步（partner-sync）：ParticipantRegistration 外部 ID 字段 + PartnerSyncRun 运行记录表
    `DO $$ BEGIN
       CREATE TYPE "PartnerSyncTrigger" AS ENUM ('WEBHOOK', 'MANUAL', 'CRON', 'AUTHORIZE');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`,
    `DO $$ BEGIN
       CREATE TYPE "PartnerSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`,
    `ALTER TABLE participant_registrations ADD COLUMN IF NOT EXISTS provider TEXT`,
    `ALTER TABLE participant_registrations ADD COLUMN IF NOT EXISTS external_id TEXT`,
    `ALTER TABLE participant_registrations ADD COLUMN IF NOT EXISTS external_status TEXT`,
    `ALTER TABLE participant_registrations ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ`,
    `CREATE TABLE IF NOT EXISTS partner_sync_runs (
       id TEXT PRIMARY KEY,
       event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       provider TEXT NOT NULL,
       trigger "PartnerSyncTrigger" NOT NULL DEFAULT 'MANUAL',
       status "PartnerSyncStatus" NOT NULL DEFAULT 'RUNNING',
       fetched INT NOT NULL DEFAULT 0,
       created INT NOT NULL DEFAULT 0,
       updated INT NOT NULL DEFAULT 0,
       cancelled INT NOT NULL DEFAULT 0,
       skipped INT NOT NULL DEFAULT 0,
       error_message TEXT,
       started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       finished_at TIMESTAMPTZ
     )`,
    `CREATE INDEX IF NOT EXISTS partner_sync_runs_event_id_provider_started_at_idx ON partner_sync_runs(event_id, provider, started_at)`,
    `CREATE INDEX IF NOT EXISTS partner_sync_runs_provider_status_started_at_idx ON partner_sync_runs(provider, status, started_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS participant_registrations_provider_external_id_key ON participant_registrations(provider, external_id)`,
    // 每场活动采集点数量上限（如百格渠道账号默认 100）
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stamp_point_limit_per_event INT`,
  ];

  const applied: string[] = [];
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    applied.push(sql.slice(0, 80));
  }

  const notificationSync = await applyNotificationSchemaSync();
  applied.push(...notificationSync.applied);

  const notificationProbe = await probeNotificationSchema();
  if (notificationProbe !== "ok") {
    return createErrorResponse(
      `通知表 DDL 已尝试执行，但 Prisma 探测仍失败: ${notificationProbe}`,
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }

  // 用与活动列表相同粒度的探测确认
  try {
    await prisma.event.findFirst({
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            participants: true,
            checkIns: true,
            ticketTypes: true,
            polls: true,
            sessions: true,
          },
        },
        settings: {
          where: { key: "event_category" },
          take: 1,
          select: { value: true },
        },
        review: {
          select: {
            status: true,
            revisionNotes: true,
            rejectionReason: true,
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(
      `DDL 已执行，但活动列表探测仍失败: ${message}`,
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }

  // partner-sync 新增字段/表的探测确认
  try {
    await prisma.participantRegistration.findFirst({
      select: { provider: true, externalId: true, externalStatus: true, syncedAt: true },
    });
    await prisma.partnerSyncRun.findFirst();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(
      `DDL 已执行，但 partner-sync 探测仍失败: ${message}`,
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }

  // 采集点配额字段探测确认
  try {
    await prisma.organization.findFirst({
      select: { stampPointLimitPerEvent: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(
      `DDL 已执行，但采集点配额字段探测仍失败: ${message}`,
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }

  return createSuccessResponse({
    applied,
    notificationEnumAlterSkipped: notificationSync.enumAlterSkipped,
    eventsListProbe: "ok",
    notificationProbe: "ok",
    partnerSyncProbe: "ok",
    stampQuotaProbe: "ok",
  });
});
