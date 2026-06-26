"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  extractEventIdFromPath,
  isEventScopedRoute,
} from "@/lib/nav-context";
import { EVENTS_QUERY_KEY } from "@/lib/query-options";
import type { EventListItem, EventListResponse } from "@/hooks/useEvents";

export type EventSummary = EventListItem;

type EventsQueryData = {
  data: EventListResponse;
  meta?: { total?: number; cursor?: string | null; hasNext?: boolean };
};

async function fetchEventsList(): Promise<EventsQueryData> {
  const res = await fetch("/api/events");
  if (!res.ok) throw new Error("加载活动失败");
  const json = await res.json();
  return {
    data: json.data as EventListResponse,
    meta: json.meta,
  };
}

type EventContextValue = {
  events: EventListItem[];
  eventStats: EventListResponse["stats"];
  currentEvent: EventListItem | null;
  currentEventId: string | null;
  setCurrentEventId: (id: string) => void;
  isLoading: boolean;
  refreshEvents: () => Promise<void>;
};

const EventContext = createContext<EventContextValue | null>(null);

function extractEventId(pathname: string) {
  return extractEventIdFromPath(pathname);
}

export function EventProvider({
  children,
  initialEvents,
}: {
  children: React.ReactNode;
  initialEvents?: EventListResponse;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentEventId, setCurrentEventIdState] = useState<string | null>(null);

  useEffect(() => {
    if (initialEvents) {
      queryClient.setQueryData(EVENTS_QUERY_KEY, {
        data: initialEvents,
        meta: { total: initialEvents.events.length },
      });
    }
  }, [initialEvents, queryClient]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: fetchEventsList,
    initialData: initialEvents
      ? { data: initialEvents, meta: { total: initialEvents.events.length } }
      : undefined,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    refetchOnMount: initialEvents ? false : true,
  });

  const events = data?.data.events ?? [];
  const eventStats = data?.data.stats ?? {
    live: 0,
    today: 0,
    upcoming: 0,
    draft: 0,
    ended: 0,
  };

  useEffect(() => {
    const fromPath = extractEventId(pathname);
    if (fromPath) {
      setCurrentEventIdState(fromPath);
      return;
    }
    if (isEventScopedRoute(pathname)) {
      return;
    }
    setCurrentEventIdState(null);
  }, [pathname]);

  const setCurrentEventId = useCallback(
    (id: string) => {
      setCurrentEventIdState(id);
      const target = events.find((e) => e.id === id);
      if (target?.listRole === "EXHIBITOR" && target.boothId) {
        router.push(`/exhibitor/booths/${target.boothId}`);
        return;
      }
      router.push(`/events/${id}`);
    },
    [router, events],
  );

  const refreshEvents = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const currentEvent = useMemo(
    () => events.find((e) => e.id === currentEventId) ?? null,
    [events, currentEventId],
  );

  const value = useMemo(
    () => ({
      events,
      eventStats,
      currentEvent,
      currentEventId,
      setCurrentEventId,
      isLoading,
      refreshEvents,
    }),
    [
      events,
      eventStats,
      currentEvent,
      currentEventId,
      setCurrentEventId,
      isLoading,
      refreshEvents,
    ],
  );

  return (
    <EventContext.Provider value={value}>{children}</EventContext.Provider>
  );
}

export function useCurrentEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error("useCurrentEvent must be used within EventProvider");
  }
  return ctx;
}

export function useOptionalCurrentEvent() {
  return useContext(EventContext);
}
