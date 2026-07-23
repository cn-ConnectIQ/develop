"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminContent, AdminHeader, AdminPage } from "@/components/admin/admin-header";
import { NewLotteryTypePicker } from "@/components/lottery/NewLotteryTypePicker";
import { ParticipantLotteryCard } from "@/components/lottery/ParticipantLotteryCard";
import { ParticipantLotteryEmptyState } from "@/components/lottery/ParticipantLotteryEmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParticipantLotteryListItem } from "@/lib/interaction/lottery-service";
import {
  computeParticipantStats,
  filterParticipantLotteries,
  formatParticipantCount,
  type ParticipantLotteryStatusFilter,
  type ParticipantLotteryTypeFilter,
} from "@/lib/lottery/participant-lottery-utils";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

type BoothOption = {
  id: string;
  code: string;
  name: string;
};

const TYPE_TABS: Array<{ value: ParticipantLotteryTypeFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "probability", label: "概率抽奖" },
  { value: "instant", label: "直接领取" },
];

const STATUS_TABS: Array<{ value: ParticipantLotteryStatusFilter; label: string }> =
  [
    { value: "all", label: "全部" },
    { value: "active", label: "进行中" },
    { value: "ended", label: "已结束" },
  ];

async function fetchParticipantLotteries(
  eventId: string,
  boothId?: string,
) {
  const params = new URLSearchParams({
    category: "AUTO_PROBABILITY,INSTANT_CLAIM",
  });
  if (boothId) params.set("boothId", boothId);
  const res = await fetch(
    withPublicPath(`/api/events/${eventId}/lotteries?${params.toString()}`),
  );
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.lotteries as ParticipantLotteryListItem[];
}

async function fetchBooths(eventId: string) {
  const res = await fetch(withPublicPath(`/api/events/${eventId}/booths`));
  if (!res.ok) throw new Error("展位加载失败");
  const json = (await res.json()) as { data?: { booths?: BoothOption[] } };
  return json.data?.booths ?? [];
}

async function patchLotteryStatus(
  eventId: string,
  lotteryId: string,
  status: "ACTIVE" | "DRAFT",
) {
  const res = await fetch(
    withPublicPath(`/api/events/${eventId}/lotteries/${lotteryId}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "操作失败");
}

async function replenishStock(
  eventId: string,
  lotteryId: string,
  addQuantity: number,
) {
  const res = await fetch(
    withPublicPath(
      `/api/events/${eventId}/lotteries/${lotteryId}/replenish-stock`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_quantity: addQuantity }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "补充失败");
}

export function ParticipantLotteryListClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName?: string;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [boothFilter, setBoothFilter] = useState("all");
  const [typeFilter, setTypeFilter] =
    useState<ParticipantLotteryTypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<ParticipantLotteryStatusFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [replenishingId, setReplenishingId] = useState<string | null>(null);

  const {
    data: lotteries = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["lotteries", eventId, "participant"],
    queryFn: () => fetchParticipantLotteries(eventId),
    retry: 1,
  });

  const { data: booths = [] } = useQuery({
    queryKey: ["event-booths", eventId],
    queryFn: () => fetchBooths(eventId),
  });

  const stats = useMemo(() => computeParticipantStats(lotteries), [lotteries]);

  const visibleLotteries = useMemo(
    () =>
      filterParticipantLotteries(lotteries, {
        initiator: boothFilter === "all" ? undefined : boothFilter,
        type: typeFilter,
        status: statusFilter,
      }),
    [lotteries, boothFilter, typeFilter, statusFilter],
  );

  const toggleMutation = useMutation({
    mutationFn: ({
      lotteryId,
      status,
    }: {
      lotteryId: string;
      status: "ACTIVE" | "DRAFT";
    }) => patchLotteryStatus(eventId, lotteryId, status),
    onMutate: ({ lotteryId }) => setTogglingId(lotteryId),
    onSuccess: (_, variables) => {
      toast.success(variables.status === "ACTIVE" ? "已恢复" : "已暂停");
      void queryClient.invalidateQueries({
        queryKey: ["lotteries", eventId, "participant"],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "操作失败");
    },
    onSettled: () => setTogglingId(null),
  });

  const replenishMutation = useMutation({
    mutationFn: ({
      lotteryId,
      quantity,
    }: {
      lotteryId: string;
      quantity: number;
    }) => replenishStock(eventId, lotteryId, quantity),
    onMutate: ({ lotteryId }) => setReplenishingId(lotteryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["lotteries", eventId, "participant"],
      });
    },
    onSettled: () => setReplenishingId(null),
  });

  return (
    <AdminPage>
      <AdminHeader
        title="参与人抽奖"
        description={eventName}
        breadcrumb={["互动管理", "参与人抽奖"]}
        actions={
          <Button className="shadow-sm" onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            新建抽奖
          </Button>
        }
      />

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
                <p className="text-sm text-text-secondary">今日参与</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-brand-green">
                  {formatParticipantCount(stats.todayEntries)}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">已发放奖品</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                  {formatParticipantCount(stats.issuedPrizes)}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-tertiary">发起方</span>
                <Select
                  value={boothFilter}
                  onValueChange={(value) => setBoothFilter(value ?? "all")}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="organizer">主办方</SelectItem>
                    {booths.map((booth) => (
                      <SelectItem key={booth.id} value={booth.id}>
                        {booth.code} · {booth.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-1">
                  <span className="mr-1 self-center text-xs text-text-tertiary">
                    类型
                  </span>
                  {TYPE_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setTypeFilter(tab.value)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        typeFilter === tab.value
                          ? "bg-surface-secondary text-text-primary"
                          : "text-text-secondary hover:bg-surface-secondary/70",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1">
                  <span className="mr-1 self-center text-xs text-text-tertiary">
                    状态
                  </span>
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        statusFilter === tab.value
                          ? "bg-brand-green-soft text-brand-green"
                          : "text-text-secondary hover:bg-surface-secondary",
                      )}
                    >
                      {tab.label}
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
            <p className="text-sm text-destructive">参与人抽奖加载失败</p>
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
          <ParticipantLotteryEmptyState
            eventId={eventId}
            onCreate={() => setCreateOpen(true)}
          />
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
                <ParticipantLotteryCard
                  key={lottery.id}
                  eventId={eventId}
                  lottery={lottery}
                  toggling={togglingId === lottery.id}
                  replenishing={replenishingId === lottery.id}
                  onTogglePause={(lotteryId, status) =>
                    toggleMutation.mutate({ lotteryId, status })
                  }
                  onReplenish={(lotteryId, quantity) =>
                    replenishMutation.mutateAsync({ lotteryId, quantity })
                  }
                />
              ))
            )}
          </div>
        )}
      </AdminContent>

      <NewLotteryTypePicker
        eventId={eventId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </AdminPage>
  );
}
