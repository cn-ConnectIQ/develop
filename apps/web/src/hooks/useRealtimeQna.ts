"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QnaListResult, QnaResponseItem } from "@/lib/qna-service";

type UseRealtimeQnaOptions = {
  eventId: string;
  pollId: string;
  enabled?: boolean;
};

export function useRealtimeQna({
  eventId,
  pollId,
  enabled = true,
}: UseRealtimeQnaOptions) {
  const [data, setData] = useState<QnaListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const fetchList = useCallback(async () => {
    if (!pollId) return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/polls/${pollId}/responses`,
      );
      if (!res.ok) throw new Error("加载问答失败");
      const json = await res.json();
      const next = json.data as QnaListResult;

      if (initializedRef.current) {
        const newIds = next.responses.filter(
          (r) => !knownIdsRef.current.has(r.id),
        );
        if (newIds.length > 0) {
          setNewCount((c) => c + newIds.length);
        }
      } else {
        initializedRef.current = true;
      }

      knownIdsRef.current = new Set(next.responses.map((r) => r.id));
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [eventId, pollId]);

  useEffect(() => {
    if (!enabled || !pollId) {
      setData(null);
      setLoading(false);
      initializedRef.current = false;
      knownIdsRef.current = new Set();
      setNewCount(0);
      return;
    }
    initializedRef.current = false;
    knownIdsRef.current = new Set();
    setNewCount(0);
    setLoading(true);
    void fetchList();
  }, [enabled, pollId, fetchList]);

  const fetchRef = useRef(fetchList);
  fetchRef.current = fetchList;

  useEffect(() => {
    if (!enabled || !pollId || !eventId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase.channel(`qna-${eventId}-${pollId}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "poll_responses",
        filter: `poll_id=eq.${pollId}`,
      },
      () => void fetchRef.current(),
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "poll_responses",
        filter: `poll_id=eq.${pollId}`,
      },
      () => void fetchRef.current(),
    );

    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "poll_responses",
        filter: `poll_id=eq.${pollId}`,
      },
      () => void fetchRef.current(),
    );

    channel.subscribe();

    const pollTimer = setInterval(() => {
      void fetchRef.current();
    }, 30_000);

    return () => {
      clearInterval(pollTimer);
      void supabase.removeChannel(channel);
    };
  }, [eventId, pollId, enabled]);

  const clearNewCount = useCallback(() => setNewCount(0), []);

  const updateLocalResponse = useCallback(
    (id: string, patch: Partial<QnaResponseItem>) => {
      setData((prev) => {
        if (!prev) return prev;
        const responses = prev.responses.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        );
        const onScreenResponse =
          patch.isOnScreen === true
            ? responses.find((r) => r.id === id) ?? null
            : patch.isOnScreen === false && prev.onScreenResponse?.id === id
              ? null
              : prev.onScreenResponse;
        return { ...prev, responses, onScreenResponse };
      });
    },
    [],
  );

  const removeLocalResponse = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        responses: prev.responses.filter((r) => r.id !== id),
        onScreenResponse:
          prev.onScreenResponse?.id === id ? null : prev.onScreenResponse,
      };
    });
  }, []);

  return {
    data,
    loading,
    error,
    newCount,
    clearNewCount,
    refetch: fetchList,
    updateLocalResponse,
    removeLocalResponse,
  };
}

export async function patchQnaResponse(
  eventId: string,
  pollId: string,
  responseId: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(
    `/api/events/${eventId}/polls/${pollId}/responses/${responseId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message ?? "操作失败");
  }
  return (await res.json()).data;
}

export async function deleteQnaResponse(
  eventId: string,
  pollId: string,
  responseId: string,
) {
  const res = await fetch(
    `/api/events/${eventId}/polls/${pollId}/responses/${responseId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("删除失败");
}

export async function markAllQnaAnswered(eventId: string, pollId: string) {
  const res = await fetch(`/api/events/${eventId}/polls/${pollId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark_all_answered" }),
  });
  if (!res.ok) throw new Error("操作失败");
}
