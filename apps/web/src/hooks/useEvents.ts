"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventCategory } from "@/lib/event-utils";
import { EVENTS_QUERY_KEY } from "@/lib/query-options";
import type { EventFeatureFlags } from "@/lib/event-feature-flags";

export type EventReviewInfo = {
  status: string;
  revisionNotes: string | null;
  rejectionReason: string | null;
};

export type EventListItem = {
  id: string;
  name: string;
  slug: string;
  type: string;
  activityType?: string;
  category: EventCategory | null;
  status: string;
  reviewStatus: string;
  location: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt?: string;
  listRole?: "HOST" | "EXHIBITOR";
  boothId?: string | null;
  boothCode?: string | null;
  readiness: { completed: number; total: number };
  review: EventReviewInfo | null;
  featureFlags?: EventFeatureFlags;
  org?: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    is_verified: boolean;
  } | null;
  _count: {
    participants: number;
    checkIns: number;
    ticketTypes: number;
    polls: number;
    sessions: number;
  };
};

export type EventListResponse = {
  events: EventListItem[];
  stats: {
    live: number;
    today: number;
    upcoming: number;
    draft: number;
    ended: number;
  };
};

export type UseEventsParams = {
  status?: string;
  phase?: string;
  cursor?: string;
  limit?: number;
};

async function fetchEvents(params: UseEventsParams = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.phase) search.set("phase", params.phase);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));

  const qs = search.toString();
  const res = await fetch(`/api/events${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("加载活动失败");
  const json = await res.json();
  return {
    data: json.data as EventListResponse,
    meta: json.meta as {
      total?: number;
      cursor?: string | null;
      hasNext?: boolean;
    },
  };
}

export function useEvents(params: UseEventsParams = {}) {
  const isDefaultList =
    !params.status && !params.phase && !params.cursor && !params.limit;

  return useQuery({
    queryKey: isDefaultList ? EVENTS_QUERY_KEY : ["events", params],
    queryFn: () => fetchEvents(params),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useEventsMutationRefetch() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["events"] });
}
