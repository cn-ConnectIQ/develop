"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LotteryDrawPanel } from "@/components/interactions/LotteryDrawPanel";
import {
  LOTTERY_STATUS_LABELS,
  parsePrizes,
  summarizePrizes,
} from "@/lib/lottery-types";
import { cn } from "@/lib/utils";

type LotteryRow = {
  id: string;
  title: string;
  status: string;
  prizes: unknown;
  entryCount?: number;
  _count?: { entries: number };
};

async function fetchLotteries(eventId: string): Promise<LotteryRow[]> {
  const res = await fetch(`/api/events/${eventId}/lotteries`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

export function LotteryPageClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [drawLottery, setDrawLottery] = useState<LotteryRow | null>(null);

  const { data: lotteries = [], isLoading } = useQuery({
    queryKey: ["lotteries", eventId],
    queryFn: () => fetchLotteries(eventId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/lotteries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "未命名抽奖",
          prizes: [
            {
              rank: 1,
              name: "一等奖",
              prize: "一等奖奖品",
              count: 1,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("创建失败");
      return (await res.json()).data as LotteryRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lotteries", eventId] });
      toast.success("抽奖已创建");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  async function patchStatus(lotteryId: string, status: string) {
    const res = await fetch(
      `/api/events/${eventId}/lotteries/${lotteryId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message ?? "操作失败");
    }
    void queryClient.invalidateQueries({ queryKey: ["lotteries", eventId] });
  }

  function getEntryCount(row: LotteryRow) {
    return row.entryCount ?? row._count?.entries ?? 0;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">抽奖管理</h1>
        <Button
          className="h-9 rounded-lg bg-brand-red px-4 text-sm font-medium text-white"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          + 创建抽奖
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">加载中…</p>
      ) : lotteries.length === 0 ? (
        <p className="text-sm text-text-muted">暂无抽奖，点击上方按钮创建</p>
      ) : (
        <div className="space-y-3">
          {lotteries.map((lottery) => {
            const statusMeta =
              LOTTERY_STATUS_LABELS[lottery.status] ??
              LOTTERY_STATUS_LABELS.DRAFT;
            const prizes = parsePrizes(lottery.prizes);
            const entryCount = getEntryCount(lottery);

            return (
              <div
                key={lottery.id}
                className="flex items-center gap-4 rounded-xl border border-border-light bg-white p-5"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-light">
                  <Gift className="size-6 text-brand-red" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{lottery.title}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {summarizePrizes(prizes)}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs",
                      statusMeta.className,
                    )}
                  >
                    {statusMeta.pulse && (
                      <span className="size-1.5 animate-pulse rounded-full bg-brand-green" />
                    )}
                    {statusMeta.label}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  <div>
                    <span className="text-xl font-bold text-brand-blue">
                      {entryCount}
                    </span>
                    <span className="ml-1 text-xs text-text-muted">人参与</span>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    {lottery.status === "DRAFT" && (
                      <>
                        <Link
                          href={`/events/${eventId}/interactions?lottery=${lottery.id}`}
                          className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm hover:bg-content-bg"
                        >
                          编辑
                        </Link>
                        <Button
                          size="sm"
                          className="h-8 bg-brand-blue text-white"
                          onClick={() =>
                            void (async () => {
                              try {
                                if (lottery.status === "DRAFT") {
                                  await patchStatus(lottery.id, "READY");
                                }
                                await patchStatus(lottery.id, "OPEN");
                                toast.success("已开始报名");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "操作失败",
                                );
                              }
                            })()
                          }
                        >
                          开始报名
                        </Button>
                      </>
                    )}
                    {lottery.status === "OPEN" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() =>
                            void patchStatus(lottery.id, "READY").then(() =>
                              toast.success("已关闭报名"),
                            ).catch((e) => toast.error(e.message))
                          }
                        >
                          关闭报名
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-brand-red font-medium text-white"
                          onClick={() => {
                            void patchStatus(lottery.id, "DRAWING").then(() => {
                              setDrawLottery(lottery);
                              toast.success("进入抽奖模式");
                            }).catch((e) => toast.error(e.message));
                          }}
                        >
                          开始抽奖 →
                        </Button>
                      </>
                    )}
                    {lottery.status === "DRAWING" && (
                      <Button
                        size="sm"
                        className="h-8 bg-brand-red text-white"
                        onClick={() => setDrawLottery(lottery)}
                      >
                        继续抽奖
                      </Button>
                    )}
                    {lottery.status === "FINISHED" && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-8 text-brand-blue"
                        onClick={() => setDrawLottery(lottery)}
                      >
                        查看结果
                      </Button>
                    )}
                    {(lottery.status === "READY") && (
                      <Link
                        href={`/events/${eventId}/interactions?lottery=${lottery.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm hover:bg-content-bg"
                      >
                        编辑
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!drawLottery}
        onOpenChange={(open) => !open && setDrawLottery(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>抽奖控制台</DialogTitle>
          </DialogHeader>
          {drawLottery && (
            <LotteryDrawPanel
              eventId={eventId}
              lotteryId={drawLottery.id}
              title={drawLottery.title}
              entryCount={getEntryCount(drawLottery)}
              prizes={drawLottery.prizes}
              onFinished={() => {
                void patchStatus(drawLottery.id, "FINISHED");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
