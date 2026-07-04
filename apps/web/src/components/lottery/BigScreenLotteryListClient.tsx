"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminContent, AdminPage } from "@/components/admin/admin-header";
import { BigScreenLotteryCard } from "@/components/lottery/BigScreenLotteryCard";
import { BigScreenLotteryEmptyState } from "@/components/lottery/BigScreenLotteryEmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import type { OrganizerLotteryDto } from "@/lib/lottery/organizer-lottery-config";
import {
  computeBigScreenStats,
  filterBigScreenLotteries,
  formatPoolCount,
  sortBigScreenLotteries,
  type BigScreenLotteryFilter,
  type BigScreenLotterySort,
} from "@/lib/lottery/big-screen-lottery-utils";
import { cn } from "@/lib/utils";

const FILTER_TABS: Array<{ value: BigScreenLotteryFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "active", label: "进行中" },
  { value: "ended", label: "已结束" },
];

const SORT_OPTIONS: Array<{ value: BigScreenLotterySort; label: string }> = [
  { value: "created_at", label: "创建时间" },
  { value: "draw_at", label: "开奖时间" },
];

async function fetchPoolDrawLotteries(eventId: string) {
  const res = await fetch(
    `/api/events/${eventId}/lotteries?category=POOL_DRAW`,
  );
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.lotteries as OrganizerLotteryDto[];
}

async function deleteDraftLottery(eventId: string, lotteryId: string) {
  const res = await fetch(
    `/api/events/${eventId}/lotteries/${lotteryId}`,
    { method: "DELETE" },
  );
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "删除失败");
}

export function BigScreenLotteryListClient({
  eventId,
}: {
  eventId: string;
  eventName?: string;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BigScreenLotteryFilter>("all");
  const [sort, setSort] = useState<BigScreenLotterySort>("created_at");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: lotteries = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["lotteries", eventId, "POOL_DRAW"],
    queryFn: () => fetchPoolDrawLotteries(eventId),
    retry: 1,
  });

  const stats = useMemo(() => computeBigScreenStats(lotteries), [lotteries]);

  const visibleLotteries = useMemo(
    () =>
      sortBigScreenLotteries(
        filterBigScreenLotteries(lotteries, filter),
        sort,
      ),
    [lotteries, filter, sort],
  );

  const deleteMutation = useMutation({
    mutationFn: (lotteryId: string) => deleteDraftLottery(eventId, lotteryId),
    onMutate: (lotteryId) => setDeletingId(lotteryId),
    onSuccess: () => {
      toast.success("草稿已删除");
      void queryClient.invalidateQueries({
        queryKey: ["lotteries", eventId, "POOL_DRAW"],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除失败");
    },
    onSettled: () => setDeletingId(null),
  });

  return (
    <AdminPage>
      <header className="admin-header flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface px-6 py-5">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-text-tertiary">互动管理 / 大屏抽奖</p>
          <h1 className="text-2xl font-bold text-text-primary">大屏抽奖</h1>
          <p className="mt-1 text-sm text-text-secondary">
            活动收尾仪式、多等级奖品的奖池抽奖
          </p>
        </div>
        <Link
          href={`/events/${eventId}/lottery/big-screen/new`}
          className={buttonVariants({ variant: "default", className: "shadow-sm" })}
        >
          <Plus data-icon="inline-start" />
          新建大屏抽奖
        </Link>
      </header>

      <AdminContent className="space-y-4">
        {!isLoading && !isError && lotteries.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:grid-cols-3">
              <div>
                <p className="text-sm text-text-secondary">进行中</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                  {stats.activeCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">已结束</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                  {stats.endedCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">奖池总人数</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-brand-green">
                  {formatPoolCount(stats.totalEntries)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFilter(tab.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      filter === tab.value
                        ? "bg-surface-secondary text-text-primary"
                        : "text-text-secondary hover:bg-surface-secondary/70 hover:text-text-primary",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary">排序</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSort(option.value)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        sort === option.value
                          ? "bg-brand-green-soft text-brand-green"
                          : "text-text-secondary hover:bg-surface-secondary",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {isLoading && (
          <p className="py-12 text-center text-sm text-text-secondary">
            加载中…
          </p>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-8 text-center">
            <p className="text-sm text-destructive">大屏抽奖加载失败</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refetch()}
            >
              重试
            </Button>
          </div>
        )}

        {!isLoading && !isError && lotteries.length === 0 && (
          <BigScreenLotteryEmptyState eventId={eventId} />
        )}

        {!isLoading && !isError && lotteries.length > 0 && (
          <div className="space-y-4">
            {visibleLotteries.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface px-5 py-10 text-center shadow-sm">
                <p className="text-sm text-text-secondary">
                  当前筛选条件下暂无抽奖
                </p>
              </div>
            ) : (
              visibleLotteries.map((lottery) => (
                <BigScreenLotteryCard
                  key={lottery.id}
                  eventId={eventId}
                  lottery={lottery}
                  deleting={deletingId === lottery.id}
                  onDelete={(lotteryId) => deleteMutation.mutate(lotteryId)}
                />
              ))
            )}
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
