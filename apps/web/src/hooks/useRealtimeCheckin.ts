"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseRealtimeCheckinOptions = {
  eventId: string;
  enabled?: boolean;
  onCheckin: () => void;
};

/**
 * 订阅 Supabase Realtime：`check_ins` INSERT 与 `participants` UPDATE。
 * 未配置 Supabase 环境变量时静默降级（依赖 React Query 轮询）。
 */
export function useRealtimeCheckin({
  eventId,
  enabled = true,
  onCheckin,
}: UseRealtimeCheckinOptions) {
  const callbackRef = useRef(onCheckin);
  callbackRef.current = onCheckin;

  useEffect(() => {
    if (!enabled || !eventId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`event-checkin-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "check_ins",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          callbackRef.current();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          callbackRef.current();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, enabled]);
}
