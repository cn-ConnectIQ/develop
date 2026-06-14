"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseBigscreenRealtimeOptions = {
  eventId: string;
  pollId?: string | null;
  enabled?: boolean;
  onUpdate: () => void;
};

/**
 * 订阅 PollResponse INSERT 与 check_ins INSERT，驱动大屏数据刷新。
 */
export function useBigscreenRealtime({
  eventId,
  pollId,
  enabled = true,
  onUpdate,
}: UseBigscreenRealtimeOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !eventId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase.channel(`bigscreen-${eventId}-${pollId ?? "all"}`);

    if (pollId) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_responses",
          filter: `poll_id=eq.${pollId}`,
        },
        () => callbackRef.current(),
      );
    }

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "check_ins",
        filter: `event_id=eq.${eventId}`,
      },
      () => callbackRef.current(),
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "participants",
        filter: `event_id=eq.${eventId}`,
      },
      () => callbackRef.current(),
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, pollId, enabled]);
}
