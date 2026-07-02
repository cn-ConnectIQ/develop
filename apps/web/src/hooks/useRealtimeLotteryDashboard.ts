"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LotteryDashboardData } from "@/lib/lottery/lottery-dashboard-service";

type UseRealtimeLotteryDashboardOptions = {
  lotteryId: string;
  eventId: string;
  enabled?: boolean;
  onUpdate: (data: LotteryDashboardData) => void;
};

export function useRealtimeLotteryDashboard({
  lotteryId,
  eventId,
  enabled = true,
  onUpdate,
}: UseRealtimeLotteryDashboardOptions) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/lotteries/${lotteryId}/dashboard`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: LotteryDashboardData };
      if (json.data) onUpdateRef.current(json.data);
    } catch {
      /* ignore */
    }
  }, [lotteryId]);

  useEffect(() => {
    if (!enabled || !lotteryId) return;

    void fetchDashboard();

    const pollTimer = setInterval(() => void fetchDashboard(), 15_000);
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return () => clearInterval(pollTimer);
    }

    const channel = supabase.channel(`lottery-dashboard-${eventId}-${lotteryId}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "lottery_entries",
        filter: `lottery_id=eq.${lotteryId}`,
      },
      () => void fetchDashboard(),
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "lottery_winners",
        filter: `lottery_id=eq.${lotteryId}`,
      },
      () => void fetchDashboard(),
    );

    channel.subscribe();

    return () => {
      clearInterval(pollTimer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, lotteryId, eventId, fetchDashboard]);

  return { refetch: fetchDashboard };
}
