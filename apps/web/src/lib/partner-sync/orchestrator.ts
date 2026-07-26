import { prisma, PartnerSyncStatus, PartnerSyncTrigger } from "@connectiq/database";
import { getPartnerParticipantAdapter } from "@/lib/partner-sync/registry";
import { syncParticipantRegistrations } from "@/lib/partner-sync/registration-merge";

/** 同 event+provider 的运行记录若仍在此窗口内 RUNNING，视为并发中，直接跳过 */
const LOCK_STALE_MS = 2 * 60 * 1000;

export type PartnerSyncResult = {
  synced_at: string;
  provider: string;
  fetched: number;
  created: number;
  updated: number;
  cancelled: number;
  skippedRows: number;
  message: string;
};

export type PartnerSyncSkipped = {
  skipped: true;
  reason: "already_running";
  runId: string;
};

async function resolveExternalEventId(
  eventId: string,
  provider: string,
): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { externalRefId: true },
  });
  if (event?.externalRefId) return event.externalRefId;

  const [setting, external] = await Promise.all([
    prisma.eventSetting.findUnique({
      where: { eventId_key: { eventId, key: `${provider}_event_id` } },
    }),
    prisma.externalSync.findUnique({
      where: { eventId_provider: { eventId, provider } },
    }),
  ]);

  if (typeof setting?.value === "string" && setting.value.trim()) {
    return setting.value.trim();
  }
  if (external?.syncConfig && typeof external.syncConfig === "object") {
    const cfg = external.syncConfig as Record<string, unknown>;
    const externalEventId = cfg.externalEventId ?? cfg.external_event_id;
    if (typeof externalEventId === "string" && externalEventId.trim()) {
      return externalEventId.trim();
    }
  }
  return null;
}

/**
 * 通用的伙伴参会人员拉取同步入口，provider 无关。
 * 具体渠道的鉴权/拉取/字段映射由 registry 里注册的 PartnerParticipantAdapter 提供。
 */
export async function runPartnerParticipantSync(input: {
  eventId: string;
  provider: string;
  trigger: PartnerSyncTrigger;
}): Promise<PartnerSyncResult | PartnerSyncSkipped> {
  const { eventId, provider, trigger } = input;

  const running = await prisma.partnerSyncRun.findFirst({
    where: {
      eventId,
      provider,
      status: PartnerSyncStatus.RUNNING,
      startedAt: { gt: new Date(Date.now() - LOCK_STALE_MS) },
    },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    return { skipped: true, reason: "already_running", runId: running.id };
  }

  const adapter = getPartnerParticipantAdapter(provider);
  if (!adapter) {
    throw new Error(`未注册的伙伴同步 provider: ${provider}`);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) throw new Error("活动不存在");

  const externalEventId = await resolveExternalEventId(eventId, provider);
  if (!externalEventId) {
    throw new Error(
      `未配置${provider}活动 ID。请在活动设置中写入 ${provider}_event_id，或在 external_syncs（provider=${provider}）的 syncConfig.externalEventId 中配置。`,
    );
  }

  const run = await prisma.partnerSyncRun.create({
    data: { eventId, provider, trigger, status: PartnerSyncStatus.RUNNING },
  });

  try {
    const auth = await adapter.resolveAuth(event.orgId);
    const rawRegistrations = await adapter.fetchRegistrations(externalEventId, auth);
    const rows = rawRegistrations
      .map((raw) => adapter.mapRegistration(raw))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const result = await syncParticipantRegistrations(eventId, provider, rows);

    const now = new Date();
    await prisma.$transaction([
      prisma.eventSetting.upsert({
        where: { eventId_key: { eventId, key: `${provider}_last_sync_at` } },
        create: { eventId, key: `${provider}_last_sync_at`, value: now.toISOString() },
        update: { value: now.toISOString() },
      }),
      prisma.event.update({
        where: { id: eventId },
        data: {
          dataSource: adapter.dataSource,
          externalRefId: externalEventId,
        },
      }),
      prisma.partnerSyncRun.update({
        where: { id: run.id },
        data: {
          status: PartnerSyncStatus.SUCCEEDED,
          fetched: rawRegistrations.length,
          created: result.created,
          updated: result.updated,
          cancelled: result.cancelled,
          skipped: result.skippedRows,
          finishedAt: now,
        },
      }),
    ]);

    const totalChanged = result.created + result.updated + result.cancelled;
    return {
      synced_at: now.toISOString(),
      provider,
      fetched: rawRegistrations.length,
      created: result.created,
      updated: result.updated,
      cancelled: result.cancelled,
      skippedRows: result.skippedRows,
      message:
        totalChanged > 0
          ? `已从${provider}同步 ${rawRegistrations.length} 条报名，新增 ${result.created}、更新 ${result.updated}、取消 ${result.cancelled}、跳过 ${result.skippedRows}`
          : rawRegistrations.length > 0
            ? `${provider}返回 ${rawRegistrations.length} 条，无有效数据可导入（跳过 ${result.skippedRows}）`
            : `${provider}侧暂无报名数据`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "同步失败";
    await prisma.partnerSyncRun.update({
      where: { id: run.id },
      data: {
        status: PartnerSyncStatus.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}
