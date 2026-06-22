"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Route, Sparkles } from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoothRouteResult } from "@/lib/ai/booth-route-service";

async function fetchBoothRoute(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/ai/booth-route`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothRouteResult;
}

export function BoothRouteClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booth-route", eventId],
    queryFn: () => fetchBoothRoute(eventId),
  });

  return (
    <AdminPage>
      <AdminHeader
        title="AI 个性化展位路线"
        description={eventName}
        breadcrumb={["参会体验", "展位路线"]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            重新生成
          </Button>
        }
      />

      <AdminContent>
        {isLoading && (
          <p className="py-12 text-center text-sm text-text-muted">AI 正在规划路线…</p>
        )}

        {isError && (
          <div className="rounded-xl border border-border-light bg-white p-8 text-center">
            <p className="text-text-muted">请先登录并完善需求标签后再试</p>
          </div>
        )}

        {data && data.route.length === 0 && (
          <div className="rounded-xl border border-border-light bg-white p-8 text-center">
            <Sparkles className="mx-auto size-8 text-brand-purple/60" />
            <p className="mt-3 text-text-muted">
              暂无匹配展位，请完善个人需求标签后重试
            </p>
          </div>
        )}

        {data && data.route.length > 0 && (
          <>
            <div className="mb-4 flex flex-wrap gap-4 rounded-xl border border-brand-purple/20 bg-brand-purple-light p-4 text-sm">
              <span className="flex items-center gap-1.5 text-brand-purple">
                <Route className="size-4" />
                {data.total_booths} 个推荐展位
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <Clock className="size-4" />
                预计 {data.estimated_total_minutes} 分钟
              </span>
            </div>

            <div className="space-y-3">
              {data.route.map((stop) => (
                <div
                  key={stop.booth_id}
                  className="flex gap-4 rounded-xl border border-border-light bg-white p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-purple/15 text-lg font-bold text-brand-purple">
                    {stop.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{stop.company_name}</p>
                      <Badge variant="outline">{stop.booth_number}</Badge>
                    </div>
                    {stop.hall && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                        <MapPin className="size-3" />
                        {stop.hall}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-brand-purple">
                      {stop.match_reason}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      建议停留 {stop.estimated_stay_minutes} 分钟
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-text-tertiary">
              生成于 {new Date(data.generated_at).toLocaleString("zh-CN")}
            </p>
          </>
        )}
      </AdminContent>
    </AdminPage>
  );
}
