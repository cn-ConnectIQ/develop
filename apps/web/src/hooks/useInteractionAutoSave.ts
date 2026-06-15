"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

type UseInteractionAutoSaveOptions<T> = {
  debounceMs?: number;
  onSave: (payload: T) => Promise<void>;
};

export function useInteractionAutoSave<T>({
  debounceMs = 600,
  onSave,
}: UseInteractionAutoSaveOptions<T>) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(async () => {
    const payload = pendingRef.current;
    if (!payload) return;
    pendingRef.current = null;
    setSaveState("saving");
    try {
      await onSaveRef.current(payload);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(
    (payload: T) => {
      pendingRef.current = payload;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, debounceMs);
    },
    [debounceMs, flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { scheduleSave, saveState, flush };
}

export async function patchPoll(
  eventId: string,
  pollId: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`/api/events/${eventId}/polls/${pollId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message ?? "保存失败");
  }
  return (await res.json()).data;
}

export async function patchLottery(
  eventId: string,
  lotteryId: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`/api/events/${eventId}/lotteries/${lotteryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message ?? "保存失败");
  }
  return (await res.json()).data;
}
