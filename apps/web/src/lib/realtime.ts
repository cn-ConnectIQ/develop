import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type LotteryWinnerPayload = {
  id: string;
  userId: string;
  prizeRank: number;
  prizeName: string;
  name: string;
  company: string | null;
  avatarUrl: string | null;
  drawnAt: string;
};

export function lotteryChannelName(eventId: string, lotteryId: string) {
  return `event:${eventId}:lottery:${lotteryId}`;
}

/**
 * 服务端：向抽奖频道广播中奖结果（Supabase Realtime broadcast）。
 */
export async function broadcastLotteryResult(
  eventId: string,
  lotteryId: string,
  winners: LotteryWinnerPayload[],
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn("[realtime] Supabase admin 未配置，跳过抽奖广播");
    return false;
  }

  const channelName = lotteryChannelName(eventId, lotteryId);
  const channel = supabase.channel(channelName);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`频道订阅失败: ${status}`));
      }
    });
  });

  await channel.send({
    type: "broadcast",
    event: "lottery-result",
    payload: { winners, lotteryId, eventId, at: new Date().toISOString() },
  });

  await supabase.removeChannel(channel);
  return true;
}

/**
 * 客户端：订阅抽奖中奖广播。
 */
export function subscribeLotteryResult(
  eventId: string,
  lotteryId: string,
  callback: (winners: LotteryWinnerPayload[]) => void,
): (() => void) | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const channelName = lotteryChannelName(eventId, lotteryId);
  let channel: RealtimeChannel | null = supabase.channel(channelName);

  channel
    .on("broadcast", { event: "lottery-result" }, (message) => {
      const payload = message.payload as {
        winners?: LotteryWinnerPayload[];
      };
      if (payload?.winners?.length) {
        callback(payload.winners);
      }
    })
    .subscribe();

  return () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}
