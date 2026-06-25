"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseRealtimeLiveOpsOptions = {
  eventId: string;
  enabled?: boolean;
  onUpdate: () => void;
};

/**
 * 订阅现场指挥中心相关表变更；未配置 Supabase 时静默降级（依赖轮询）。
 */
export function useRealtimeLiveOps({
  eventId,
  enabled = true,
  onUpdate,
}: UseRealtimeLiveOpsOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !eventId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`live-ops-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "check_ins",
          filter: `event_id=eq.${eventId}`,
        },
        () => callbackRef.current(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `event_id=eq.${eventId}`,
        },
        () => callbackRef.current(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "business_connections",
          filter: `event_id=eq.${eventId}`,
        },
        () => callbackRef.current(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "interaction_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        () => callbackRef.current(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
        },
        () => callbackRef.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, enabled]);
}
