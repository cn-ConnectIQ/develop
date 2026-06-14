"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseRealtimeBoothLeadsOptions = {
  boothId: string;
  enabled?: boolean;
  onUpdate: () => void;
};

export function useRealtimeBoothLeads({
  boothId,
  enabled = true,
  onUpdate,
}: UseRealtimeBoothLeadsOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !boothId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`booth-leads-${boothId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: `booth_id=eq.${boothId}`,
        },
        () => callbackRef.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boothId, enabled]);
}
