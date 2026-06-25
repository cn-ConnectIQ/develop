"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LiveStatusBar } from "@/components/liveops/LiveStatusBar";
import { CheckinStream } from "@/components/liveops/CheckinStream";
import { InteractionWarRoom } from "@/components/liveops/InteractionWarRoom";
import { ConnectionHeat } from "@/components/liveops/ConnectionHeat";
import { BoothHeatRank } from "@/components/liveops/BoothHeatRank";
import { QuickCommandBar } from "@/components/liveops/QuickCommandBar";
import { useRealtimeLiveOps } from "@/hooks/useRealtimeLiveOps";
import type { LiveOpsPayload } from "@/lib/live-ops-types";

async function fetchLiveOps(eventId: string): Promise<LiveOpsPayload> {
  const res = await fetch(`/api/events/${eventId}/live-ops`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

export function LiveOpsPageClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["live-ops", eventId],
    queryFn: () => fetchLiveOps(eventId),
    refetchInterval: 15000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["live-ops", eventId] });
  }, [eventId, queryClient]);

  useRealtimeLiveOps({
    eventId,
    enabled: Boolean(data),
    onUpdate: refresh,
  });

  const isLive =
    data?.event.phase === "live" || data?.event.status === "LIVE";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-white/60">
        加载现场数据…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f1117] text-white">
        <p>无法加载现场指挥中心</p>
        <button
          type="button"
          className="text-brand-blue hover:underline"
          onClick={() => void refetch()}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="live-ops min-h-screen bg-[#0f1117] pb-24 text-white">
      <LiveStatusBar
        eventName={data.event.name}
        isLive={isLive}
        statusBar={data.status_bar}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <Link
          href={`/events/${eventId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回活动工作台
        </Link>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CheckinStream
            rate={data.checkin.rate}
            recent={data.checkin.recent}
            velocity={data.checkin.velocity}
          />
          <InteractionWarRoom
            eventId={eventId}
            interactions={data.interactions}
          />
          <ConnectionHeat connections={data.connections} />
          <BoothHeatRank
            eventId={eventId}
            top={data.booth_heat.top}
            cold={data.booth_heat.cold}
          />
        </div>
      </div>

      <QuickCommandBar eventId={eventId} />
    </div>
  );
}
