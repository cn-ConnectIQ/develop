"use client";

import { useQuery } from "@tanstack/react-query";
import { useOptionalCurrentEvent } from "@/contexts/event-context";
import {
  DEFAULT_EVENT_FEATURE_FLAGS,
  type EventFeatureFlags,
} from "@/lib/event-feature-flags";
import { withPublicPath } from "@/lib/public-path";

async function fetchFeatureFlags(eventId: string): Promise<EventFeatureFlags> {
  const res = await fetch(withPublicPath(`/api/events/${eventId}/feature-flags`));
  if (!res.ok) return DEFAULT_EVENT_FEATURE_FLAGS;
  const json = await res.json();
  return (json.data?.feature_flags ?? DEFAULT_EVENT_FEATURE_FLAGS) as EventFeatureFlags;
}

export function useEventFeatureFlags(eventId: string | null | undefined) {
  const ctx = useOptionalCurrentEvent();
  const cached = ctx?.events.find((event) => event.id === eventId)?.featureFlags;

  return useQuery({
    queryKey: ["feature-flags", eventId],
    queryFn: () => fetchFeatureFlags(eventId!),
    enabled: Boolean(eventId),
    initialData: cached,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: cached ? false : true,
  });
}
