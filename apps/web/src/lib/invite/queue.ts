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

export async function triggerInviteProcessing(campaignId: string) {
  await enqueueInviteCampaign(campaignId);

  const { processSendQueue } = await import("@/lib/invite-sender");

  if (process.env.NODE_ENV === "development") {
    await processSendQueue(campaignId);
    return;
  }

  setImmediate(() => {
    void processSendQueue(campaignId);
  });
}
