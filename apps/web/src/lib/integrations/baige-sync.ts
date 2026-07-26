import { prisma, PartnerSyncTrigger } from "@connectiq/database";
import { getBaigeConnectionStatus } from "@/lib/integrations/baige-connection";
import { BAIGE_PROVIDER } from "@/lib/integrations/baige-partner-constants";
import { runPartnerParticipantSync } from "@/lib/partner-sync/orchestrator";

export type BaigeSyncResult = {
  synced_at: string;
  provider: string;
  created: number;
  updated: number;
  cancelled: number;
  skippedRows: number;
  fetched: number;
  message: string;
};

export async function getBaigeEventSyncStatus(eventId: string) {
  const [lastSync, event, connection] = await Promise.all([
    prisma.eventSetting.findUnique({
      where: { eventId_key: { eventId, key: `${BAIGE_PROVIDER}_last_sync_at` } },
    }),
    prisma.event.findUnique({ where: { id: eventId }, select: { externalRefId: true } }),
    getBaigeConnectionStatus(),
  ]);

  return {
    lastSyncAt: typeof lastSync?.value === "string" ? lastSync.value : null,
    baigeEventId: event?.externalRefId ?? null,
    platformConnected: connection.connected,
  };
}

/** 拉取并落库百格活动的参会人员，具体拉取/映射逻辑见 baige-participant-adapter.ts */
export async function syncBaigeParticipants(
  eventId: string,
  trigger: PartnerSyncTrigger = PartnerSyncTrigger.MANUAL,
): Promise<BaigeSyncResult> {
  const result = await runPartnerParticipantSync({
    eventId,
    provider: BAIGE_PROVIDER,
    trigger,
  });

  if ("skipped" in result) {
    return {
      synced_at: new Date().toISOString(),
      provider: BAIGE_PROVIDER,
      fetched: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      skippedRows: 0,
      message: "已有同步任务正在进行中，请稍后重试",
    };
  }

  return result;
}
