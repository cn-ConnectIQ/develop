"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_EVENT_FEATURE_FLAGS,
  type EventFeatureFlags,
} from "@/lib/event-feature-flags";

async function fetchFeatureFlags(eventId: string): Promise<EventFeatureFlags> {
  const res = await fetch(`/api/events/${eventId}/feature-flags`);
  if (!res.ok) return DEFAULT_EVENT_FEATURE_FLAGS;
  const json = await res.json();
  return (json.data?.feature_flags ?? DEFAULT_EVENT_FEATURE_FLAGS) as EventFeatureFlags;
}

export function useEventFeatureFlags(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["feature-flags", eventId],
    queryFn: () => fetchFeatureFlags(eventId!),
    enabled: Boolean(eventId),
    staleTime: 60_000,
  });
}
