import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ScreenAnimationType } from "@/lib/lottery/organizer-lottery-config";

export const LOTTERY_SCREEN_BROADCAST_EVENT = "lottery-screen";

export type LotteryScreenEventType =
  | "START_ANIMATION"
  | "REVEAL_WINNER"
  | "END";

export type LotteryScreenRollingEntry = {
  id: string;
  name: string;
  company: string | null;
};

export type LotteryScreenWinnerPayload = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  prize_name: string;
  prize_rank: number;
  verification_code: string | null;
  pickup_note: string;
};

export type LotteryScreenStartData = {
  lottery_id: string;
  title: string;
  animation: ScreenAnimationType;
  entry_count: number;
  rolling_entries: LotteryScreenRollingEntry[];
  prizes: Array<{ rank: number; name: string; quantity: number }>;
};

export type LotteryScreenRevealData = {
  lottery_id: string;
  winner: LotteryScreenWinnerPayload;
  revealed_total: number;
  winner_quota: number;
};

export type LotteryScreenEndData = {
  lottery_id: string;
  total_winners: number;
};

export type LotteryScreenMessage =
  | { type: "START_ANIMATION"; data: LotteryScreenStartData }
  | { type: "REVEAL_WINNER"; data: LotteryScreenRevealData }
  | { type: "END"; data: LotteryScreenEndData };

export type LotteryScreenBroadcast = LotteryScreenMessage & {
  at: string;
};

export function lotteryScreenChannelName(eventId: string) {
  return `event:${eventId}:lottery-screen`;
}

async function withBroadcastChannel(
  channelName: string,
  send: (channel: RealtimeChannel, supabase: SupabaseClient) => Promise<void>,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn("[lottery-screen] Supabase admin 未配置，跳过广播");
    return false;
  }

  const channel = supabase.channel(channelName);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`频道订阅失败: ${status}`));
      }
    });
  });

  try {
    await send(channel, supabase);
    return true;
  } finally {
    await supabase.removeChannel(channel);
  }
}

export async function broadcastLotteryScreenMessage(
  eventId: string,
  message: LotteryScreenMessage,
): Promise<boolean> {
  const channelName = lotteryScreenChannelName(eventId);
  const payload: LotteryScreenBroadcast = {
    ...message,
    at: new Date().toISOString(),
  };

  return withBroadcastChannel(channelName, async (channel) => {
    await channel.send({
      type: "broadcast",
      event: LOTTERY_SCREEN_BROADCAST_EVENT,
      payload,
    });
  });
}

export function subscribeLotteryScreen(
  eventId: string,
  callback: (message: LotteryScreenBroadcast) => void,
): (() => void) | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const channelName = lotteryScreenChannelName(eventId);
  let channel: RealtimeChannel | null = supabase.channel(channelName);

  channel
    .on("broadcast", { event: LOTTERY_SCREEN_BROADCAST_EVENT }, (message) => {
      const payload = message.payload as LotteryScreenBroadcast;
      if (payload?.type) callback(payload);
    })
    .subscribe();

  return () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}
