"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import type { StampRallyStats as StatsData } from "@/lib/stamp/stamp-rally-organizer-service";
import { cn } from "@/lib/utils";

async function fetchStats(eventId: string, rallyId: string) {
  const res = await fetch(
    `/api/events/${eventId}/stamp-rallies/${rallyId}/stats`,
  );
  if (!res.ok) throw new Error("加载统计失败");
  return (await res.json()).data as StatsData;
}

async function sendRemind(eventId: string, rallyId: string) {
  const res = await fetch(
    `/api/events/${eventId}/stamp-rallies/${rallyId}/remind`,
    { method: "POST" },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "推送失败");
  return json.data as {
    targeted: number;
    wechat_sent: number;
    wechat_skipped: number;
  };
}

type StampRallyStatsProps = {
  eventId: string;
  rallyId: string;
  rallyName: string;
  isActive: boolean;
};

export function StampRallyStats({
  eventId,
  rallyId,
  rallyName,
  isActive,
}: StampRallyStatsProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["stamp-rally-stats", eventId, rallyId],
    queryFn: () => fetchStats(eventId, rallyId),
    enabled: isActive,
    refetchInterval: isActive ? 15_000 : false,
  });

  const remindMutation = useMutation({
    mutationFn: () => sendRemind(eventId, rallyId),
    onSuccess: (result) => {
      toast.success(
        `已向 ${result.targeted} 位未完成参会者发送提醒（微信 ${result.wechat_sent} 条）`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["stamp-rally-stats", eventId, rallyId],
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "推送失败");
    },
  });

  if (!isActive) return null;

  const maxCount = Math.max(
    ...(data?.booth_rankings.map((r) => r.collect_count) ?? [1]),
    1,
  );

  return (
    <SectionCard
      title="进行中监控"
      description={`${rallyName} · 每 15 秒自动刷新`}
      action={
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <Loader2 className="size-4 animate-spin text-text-muted" />
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={remindMutation.isPending}
            onClick={() => remindMutation.mutate()}
          >
            {remindMutation.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Bell className="mr-1 size-4" />
            )}
            推送提醒
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-muted">加载统计…</p>
      ) : data ? (
        <div className="space-y-6 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border-light bg-brand-blue-light/30 p-4">
              <p className="text-xs text-text-muted">参与人数</p>
              <p className="mt-1 text-3xl font-bold text-brand-blue">
                {data.participant_count}
              </p>
            </div>
            <div className="rounded-xl border border-border-light bg-brand-green-light/30 p-4">
              <p className="text-xs text-text-muted">已完成人数</p>
              <p className="mt-1 text-3xl font-bold text-brand-green">
                {data.completed_count}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-[var(--admin-ink)]">
              展位章收集热度排行
            </p>
            <div className="space-y-2">
              {data.booth_rankings.map((row, index) => (
                <div
                  key={row.booth_id}
                  className="flex items-center gap-3 rounded-lg border border-border-light px-3 py-2"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      index === 0
                        ? "bg-brand-gold/20 text-brand-gold"
                        : "bg-gray-100 text-text-muted",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-lg">
                    {row.icon && !row.icon.startsWith("http") ? (
                      row.icon
                    ) : row.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.icon}
                        alt=""
                        className="size-6 rounded object-cover"
                      />
                    ) : (
                      <Trophy className="size-5 text-brand-gold" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.stamp_name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {row.booth_code} · {row.company_name}
                      {row.weight > 1 && ` · 权重×${row.weight}`}
                    </p>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-brand-blue transition-all"
                        style={{
                          width: `${(row.collect_count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-xs text-text-muted">
                      {row.collect_count} 次
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
