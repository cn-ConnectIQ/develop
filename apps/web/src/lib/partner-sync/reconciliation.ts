import { prisma, PartnerConnectionStatus, PartnerSyncTrigger } from "@connectiq/database";
import {
  getPartnerParticipantAdapter,
  listPartnerParticipantProviders,
} from "@/lib/partner-sync/registry";
import { runPartnerParticipantSync } from "@/lib/partner-sync/orchestrator";

/** 距上次同步超过该时长才需要兜底重拉，避免和 webhook/手动同步抢跑 */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;
/** 活动结束超过这么久就不再兜底同步，避免无限重拉已归档的历史活动 */
const EVENT_ENDED_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** 每次 cron 运行处理的活动数上限，避免打爆伙伴 API */
const MAX_EVENTS_PER_RUN = 20;

export type ReconciliationEntry = {
  eventId: string;
  provider: string;
  status: "synced" | "skipped" | "failed";
  message?: string;
};

export type ReconciliationSummary = {
  checked: number;
  synced: number;
  skipped: number;
  failed: number;
  results: ReconciliationEntry[];
};

async function isStale(eventId: string, provider: string): Promise<boolean> {
  const setting = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: `${provider}_last_sync_at` } },
  });
  if (typeof setting?.value !== "string") return true;
  const lastSync = new Date(setting.value).getTime();
  if (Number.isNaN(lastSync)) return true;
  return Date.now() - lastSync > STALE_THRESHOLD_MS;
}

/**
 * 定时兜底：对已授权但可能因 webhook 漏发/失败而落后的活动，逐个重新拉取参会人员。
 * 不依赖任何队列基础设施，直接复用 runPartnerParticipantSync 的并发锁与运行记录。
 */
export async function runPartnerParticipantReconciliation(): Promise<ReconciliationSummary> {
  const results: ReconciliationEntry[] = [];
  const cutoff = new Date(Date.now() - EVENT_ENDED_GRACE_MS);

  for (const provider of listPartnerParticipantProviders()) {
    const adapter = getPartnerParticipantAdapter(provider);
    if (!adapter) continue;

    const candidates = await prisma.event.findMany({
      where: {
        dataSource: adapter.dataSource,
        OR: [{ endDate: null }, { endDate: { gte: cutoff } }],
        org: {
          partnerConnections: {
            some: { provider, status: PartnerConnectionStatus.ACTIVE },
          },
        },
      },
      select: { id: true },
      take: MAX_EVENTS_PER_RUN,
    });

    for (const candidate of candidates) {
      if (!(await isStale(candidate.id, provider))) continue;

      try {
        const result = await runPartnerParticipantSync({
          eventId: candidate.id,
          provider,
          trigger: PartnerSyncTrigger.CRON,
        });
        if ("skipped" in result) {
          results.push({ eventId: candidate.id, provider, status: "skipped" });
        } else {
          results.push({
            eventId: candidate.id,
            provider,
            status: "synced",
            message: result.message,
          });
        }
      } catch (err) {
        results.push({
          eventId: candidate.id,
          provider,
          status: "failed",
          message: err instanceof Error ? err.message : "同步失败",
        });
      }
    }
  }

  return {
    checked: results.length,
    synced: results.filter((r) => r.status === "synced").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}
