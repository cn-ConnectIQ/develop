"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimePollResults } from "@/lib/interaction-manager";

type UseRealtimePollResultsOptions = {
  eventId: string;
  pollId: string | null;
  enabled?: boolean;
};

export function useRealtimePollResults({
  eventId,
  pollId,
  enabled = true,
}: UseRealtimePollResultsOptions) {
  const [data, setData] = useState<RealtimePollResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!pollId) return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/polls/${pollId}/realtime-results`,
      );
      if (!res.ok) throw new Error("加载实时结果失败");
      const json = await res.json();
      setData(json.data as RealtimePollResults);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, [eventId, pollId]);

  useEffect(() => {
    if (!enabled || !pollId) {
      setData(null);
      return;
    }
    setLoading(true);
    void fetchResults().finally(() => setLoading(false));
  }, [enabled, pollId, fetchResults]);

  const callbackRef = useRef(fetchResults);
  callbackRef.current = fetchResults;

  useEffect(() => {
    if (!enabled || !pollId || !eventId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase.channel(`poll-results-${eventId}-${pollId}`);
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "poll_responses",
        filter: `poll_id=eq.${pollId}`,
      },
      () => void callbackRef.current(),
    );
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, pollId, enabled]);

  return { data, loading, error, refetch: fetchResults };
}
