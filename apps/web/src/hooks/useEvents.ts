"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventCategory } from "@/lib/event-utils";

export type EventListItem = {
  id: string;
  name: string;
  slug: string;
  type: string;
  category: EventCategory | null;
  status: string;
  location: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  readiness: { completed: number; total: number };
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
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => fetchEvents(params),
  });
}

export function useEventsMutationRefetch() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["events"] });
}
