"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { StampMonitorPanel } from "@/components/expo/StampMonitorPanel";
import { Button } from "@/components/ui/button";
import { backgroundPoll } from "@/lib/query-options";

export function StampMonitorClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const { refetch } = useQuery({
    queryKey: ["stamp-monitor", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/account/events/${eventId}/stamp-monitor`);
      if (!res.ok) throw new Error("加载失败");
      return (await res.json()).data;
    },
    ...backgroundPoll(15_000),
  });

  return (
    <AdminPage>
      <AdminHeader
        title="集章监控"
        description={`${eventName} · 实时集章进度`}
        actions={
          <div className="flex gap-2">
            <Link href={`/events/${eventId}/stamp-rally`}>
              <Button variant="outline">返回集章打卡</Button>
            </Link>
            <Button variant="outline" onClick={() => void refetch()}>
              刷新
            </Button>
          </div>
        }
      />
      <AdminContent>
        <StampMonitorPanel eventId={eventId} />
      </AdminContent>
    </AdminPage>
  );
}

export type { StampMonitorBooth, StampMonitorData } from "@/components/expo/StampMonitorPanel";
