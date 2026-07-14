import { getRedis } from "@/lib/redis";

const INVITE_SEND_QUEUE_KEY = "invite:send_queue";

export async function enqueueInviteCampaign(campaignId: string) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.lpush(INVITE_SEND_QUEUE_KEY, campaignId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 入队并触发发送。生产环境不阻塞 HTTP；开发环境同步跑完便于联调。
 * Cron `/api/cron/invite-send` 会兜底扫库，即使本进程未跑完也能续发。
 */
export async function triggerInviteProcessing(campaignId: string) {
  await enqueueInviteCampaign(campaignId);

  const { processSendQueue } = await import("@/lib/invite-sender");

  if (process.env.NODE_ENV === "development") {
    await processSendQueue(campaignId);
    return;
  }

  setImmediate(() => {
    void processSendQueue(campaignId).catch((err) =>
      console.error("[invite] processSendQueue failed", campaignId, err),
    );
  });
}
