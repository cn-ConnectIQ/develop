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
import { useSession } from "next-auth/react";
import { UserRole } from "@connectiq/types";
import {
  extractEventIdFromPath,
  isEventScopedRoute,
} from "@/lib/nav-context";

export type EventSummary = {
  id: string;
  name: string;
  status: string;
  type: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
};

type EventContextValue = {
  events: EventSummary[];
  currentEvent: EventSummary | null;
  currentEventId: string | null;
  setCurrentEventId: (id: string) => void;
  isLoading: boolean;
  refreshEvents: () => Promise<void>;
};

const EventContext = createContext<EventContextValue | null>(null);

function extractEventId(pathname: string) {
  return extractEventIdFromPath(pathname);
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentEventId, setCurrentEventIdState] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/events");
      const json = await res.json();
      setEvents(json.data?.events ?? json.data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

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
      if (role === UserRole.EXPO_ORGANIZER) {
        router.push(`/expos/${id}`);
      } else {
        router.push(`/events/${id}`);
      }
    },
    [router, role],
  );

  const currentEvent = useMemo(
    () => events.find((e) => e.id === currentEventId) ?? null,
    [events, currentEventId],
  );

  const value = useMemo(
    () => ({
      events,
      currentEvent,
      currentEventId,
      setCurrentEventId,
      isLoading,
      refreshEvents,
    }),
    [
      events,
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
