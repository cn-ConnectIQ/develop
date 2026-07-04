import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { InteractionType } from "@connectiq/database";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const SCREEN_PAIRING_BROADCAST_EVENT = "screen-pairing";

export type ScreenPairingPairedPayload = {
  eventId: string;
  eventName: string | null;
  interactionType: InteractionType;
  interactionId: string;
  interactionName: string | null;
  pairedAt: string;
};

export type ScreenPairingBroadcast =
  | { type: "PAIRED"; data: ScreenPairingPairedPayload }
  | { type: "RESET"; data: { pairingToken: string } };

export type ScreenPairingBroadcastMessage = ScreenPairingBroadcast & {
  at: string;
};

export function screenPairingChannelName(pairingToken: string) {
  return `screen:${pairingToken}`;
}

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

export function subscribeScreenPairing(
  pairingToken: string,
  callback: (message: ScreenPairingBroadcastMessage) => void,
  options?: {
    onConnectionChange?: (connected: boolean) => void;
  },
): (() => void) | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const channelName = screenPairingChannelName(pairingToken);
  let channel: RealtimeChannel | null = supabase.channel(channelName);

  channel
    .on("broadcast", { event: SCREEN_PAIRING_BROADCAST_EVENT }, (message) => {
      const payload = message.payload as ScreenPairingBroadcastMessage;
      if (payload?.type) callback(payload);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        options?.onConnectionChange?.(true);
      }
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        options?.onConnectionChange?.(false);
      }
    });

  return () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}
