"use client";

import { useOptionalCurrentEvent } from "@/contexts/event-context";

/** 优先使用 layout 预取的活动列表，避免每个页面额外请求 /api/events/:id */
export function useIsEventReviewLocked(eventId: string) {
  const ctx = useOptionalCurrentEvent();
  const event =
    ctx?.events.find((item) => item.id === eventId) ??
    (ctx?.currentEventId === eventId ? ctx.currentEvent : null);

  if (event) {
    return event.review?.status === "PENDING_REVIEW";
  }

  return false;
}
