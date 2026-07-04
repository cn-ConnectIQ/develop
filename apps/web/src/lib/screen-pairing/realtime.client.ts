"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  SCREEN_PAIRING_BROADCAST_EVENT,
  screenPairingChannelName,
  type ScreenPairingBroadcastMessage,
} from "@/lib/screen-pairing/shared";

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
