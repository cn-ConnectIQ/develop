"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { backgroundPoll } from "@/lib/query-options";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminContent } from "@/components/admin/admin-header";
import { CheckinHourlyChart } from "@/components/checkin/CheckinHourlyChart";
import { CheckinLiveFeed } from "@/components/checkin/CheckinLiveFeed";
import { CheckinStatsCard } from "@/components/checkin/CheckinStatsCard";
import { VipStatusList } from "@/components/checkin/VipStatusList";
import { useRealtimeCheckin } from "@/hooks/useRealtimeCheckin";
import type { CheckinDashboardData } from "@/lib/checkin-types";

async function fetchCheckin(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/checkin`);
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.data as CheckinDashboardData;
}

export function CheckinPageClient({ eventId }: { eventId: string }) {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checkin", eventId],
    queryFn: () => fetchCheckin(eventId),
    ...backgroundPoll(30_000),
  });

  useRealtimeCheckin({
    eventId,
    onCheckin: () => {
      setLastUpdated(new Date());
      void refetch();
    },
  });

  return (
    <AdminContent>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">签到看板</h1>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/scan`}>
            <Button variant="outline">扫码核验</Button>
          </Link>
          <Link href={`/events/${eventId}/participants?status=pending`}>
            <Button variant="outline">手动签到</Button>
          </Link>
          <Link href={`/events/${eventId}/checkin/bigscreen`} target="_blank">
            <Button variant="outline">
              <ExternalLink className="mr-1.5 size-4" />
              大屏模式 ↗
            </Button>
          </Link>
        </div>
      </div>

      <CheckinStatsCard stats={data?.stats} lastUpdated={lastUpdated} />

      <CheckinHourlyChart data={data?.hourly ?? []} />

      <VipStatusList items={data?.vipList ?? []} isLoading={isLoading} />

      <CheckinLiveFeed items={data?.recent ?? []} isLoading={isLoading} />
    </AdminContent>
  );
}
