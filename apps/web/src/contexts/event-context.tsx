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
import { withPublicPath } from "@/lib/public-path";
import type { EventListItem, EventListResponse } from "@/hooks/useEvents";

export type EventSummary = EventListItem;

type EventsQueryData = {
  data: EventListResponse;
  meta?: { total?: number; cursor?: string | null; hasNext?: boolean };
};

async function fetchEventsList(): Promise<EventsQueryData> {
  // 侧栏切换器需要尽量完整列表；默认 API limit=50 会导致「URL 有活动但列表里找不到」
  const res = await fetch(withPublicPath("/api/events?limit=100"));
  if (!res.ok) throw new Error("加载活动失败");
  const json = await res.json();
  return {
    data: json.data as EventListResponse,
    meta: json.meta,
  };
}

/** 列表未包含当前 URL 活动时，按 ID 补一条摘要 */
async function fetchEventSummary(
  eventId: string,
): Promise<EventListItem | null> {
  const res = await fetch(withPublicPath(`/api/events/${eventId}`));
  if (!res.ok) return null;
  const json = await res.json();
  const e = json.data as {
    id: string;
    name: string;
    slug?: string;
    type?: string;
    activityType?: string;
    category?: EventListItem["category"];
    status?: string;
    reviewStatus?: string;
    location?: string | null;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    review?: EventListItem["review"];
  };
  if (!e?.id || !e?.name) return null;
  return {
    id: e.id,
    name: e.name,
    slug: e.slug ?? "",
    type: e.type ?? "CONFERENCE",
    activityType: e.activityType,
    category: e.category ?? null,
    status: e.status ?? "DRAFT",
    reviewStatus: e.reviewStatus ?? "DRAFT",
    location: e.location ?? null,
    description: e.description ?? null,
    startDate: e.startDate ?? null,
    endDate: e.endDate ?? null,
    listRole: "HOST",
    readiness: { completed: 0, total: 0 },
    review: e.review ?? null,
    _count: {
      participants: 0,
      checkIns: 0,
      ticketTypes: 0,
      polls: 0,
      sessions: 0,
    },
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
  const [currentEventId, setCurrentEventIdState] = useState<string | null>(
    () => extractEventIdFromPath(pathname),
  );
  const [pathEventFallback, setPathEventFallback] =
    useState<EventListItem | null>(null);

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

  const listedEvents = data?.data.events ?? [];
  const eventStats = data?.data.stats ?? {
    live: 0,
    today: 0,
    upcoming: 0,
    draft: 0,
    ended: 0,
  };

  // 路径优先同步当前活动；离开活动路由时清空
  useEffect(() => {
    const fromPath = extractEventIdFromPath(pathname);
    if (fromPath) {
      setCurrentEventIdState(fromPath);
      return;
    }
    if (isEventScopedRoute(pathname)) {
      return;
    }
    setCurrentEventIdState(null);
    setPathEventFallback(null);
  }, [pathname]);

  // URL 活动不在列表中时补拉详情（分页截断 / 跨组织等）
  useEffect(() => {
    if (!currentEventId) {
      setPathEventFallback(null);
      return;
    }
    if (listedEvents.some((e) => e.id === currentEventId)) {
      setPathEventFallback(null);
      return;
    }
    let cancelled = false;
    void fetchEventSummary(currentEventId).then((item) => {
      if (!cancelled) setPathEventFallback(item);
    });
    return () => {
      cancelled = true;
    };
  }, [currentEventId, listedEvents]);

  const events = useMemo(() => {
    if (
      pathEventFallback &&
      !listedEvents.some((e) => e.id === pathEventFallback.id)
    ) {
      return [pathEventFallback, ...listedEvents];
    }
    return listedEvents;
  }, [listedEvents, pathEventFallback]);

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
