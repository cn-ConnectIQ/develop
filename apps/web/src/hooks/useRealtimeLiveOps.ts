"use client";

import { useEffect, useRef } from "react";
import { subscribeEventLiveStats } from "@/lib/realtime/subscribe-live-stats";

type UseRealtimeLiveOpsOptions = {
  eventId: string;
  enabled?: boolean;
  onUpdate: () => void;
};

/**
 * 订阅现场指挥中心 / AD 实时概览相关表变更。
 * 频道约定：`event:{eventId}:live-stats`（见 `@/lib/realtime/channels`）
 * 未配置 Supabase 时静默降级，依赖 `live-ops` / `live-stats` 轮询。
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

    const unsubscribe = subscribeEventLiveStats(eventId, () => {
      callbackRef.current();
    });

    return unsubscribe ?? undefined;
  }, [eventId, enabled]);
}
