import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  SCREEN_PAIRING_BROADCAST_EVENT,
  screenPairingChannelName,
  type ScreenPairingBroadcast,
  type ScreenPairingBroadcastMessage,
  type ScreenPairingPairedPayload,
} from "@/lib/screen-pairing/shared";

export type {
  ScreenPairingBroadcast,
  ScreenPairingBroadcastMessage,
  ScreenPairingPairedPayload,
};

async function withBroadcastChannel(
  channelName: string,
  send: (channel: RealtimeChannel, supabase: SupabaseClient) => Promise<void>,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn("[screen-pairing] Supabase admin 未配置，跳过广播");
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

export async function broadcastScreenPairingMessage(
  pairingToken: string,
  message: ScreenPairingBroadcast,
): Promise<boolean> {
  const channelName = screenPairingChannelName(pairingToken);
  const payload: ScreenPairingBroadcastMessage = {
    ...message,
    at: new Date().toISOString(),
  };

  return withBroadcastChannel(channelName, async (channel) => {
    await channel.send({
      type: "broadcast",
      event: SCREEN_PAIRING_BROADCAST_EVENT,
      payload,
    });
  });
}

export async function broadcastScreenPairingPaired(
  pairingToken: string,
  data: ScreenPairingPairedPayload,
): Promise<boolean> {
  return broadcastScreenPairingMessage(pairingToken, { type: "PAIRED", data });
}
