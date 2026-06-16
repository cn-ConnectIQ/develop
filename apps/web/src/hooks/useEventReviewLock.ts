"use client";

import { useQuery } from "@tanstack/react-query";

export function useEventReviewLock(eventId: string) {
  return useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("加载失败");
      return (await res.json()).data as {
        reviewStatus: string;
        review: {
          revisionNotes: string | null;
          rejectionReason: string | null;
        } | null;
      };
    },
    enabled: !!eventId,
  });
}

export function useIsEventReviewLocked(eventId: string) {
  const { data } = useEventReviewLock(eventId);
  return data?.reviewStatus === "PENDING_REVIEW";
}
