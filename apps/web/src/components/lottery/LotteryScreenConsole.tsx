"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SCREEN_ANIMATION_OPTIONS, tierMedal } from "@/lib/lottery/organizer-lottery-config";
import type {
  OrganizerLotteryDto,
  PrizeDrawOrder,
} from "@/lib/lottery/organizer-lottery-config";
import type { LotteryTierState } from "@/lib/lottery/lottery-screen-service";
import { cn } from "@/lib/utils";

type ScreenState = {
  lottery: {
    id: string;
    title: string;
    status: string;
    draw_at: string | null;
    entry_count: number;
    animation: string;
    prize_draw_order: PrizeDrawOrder;
  };
  winner_quota: number;
  revealed_count: number;
  active_tier: number | null;
  tiers: LotteryTierState[];
  winners: Array<{
    id: string;
    name: string;
    company: string | null;
    prize_name: string;
    prize_rank: number;
    verification_code: string | null;
    pickup_note: string;
  }>;
};

async function fetchGrandLottery(eventId: string, lotteryId?: string | null) {
  const params = new URLSearchParams({ category: "POOL_DRAW" });
  if (lotteryId) params.set("lottery_id", lotteryId);
  const res = await fetch(`/api/events/${eventId}/lotteries?${params.toString()}`);
  if (!res.ok) throw new Error("加载失败");
  const lotteries = (await res.json()).data.lotteries as OrganizerLotteryDto[];
  return lotteries[0] ?? null;
}

async function fetchScreenState(eventId: string, lotteryId: string) {
  const res = await fetch(
    `/api/events/${eventId}/lotteries/${lotteryId}/screen-state`,
  );
  if (!res.ok) throw new Error("加载状态失败");
  return (await res.json()).data as ScreenState;
}

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setRemaining(null);
      return;
    }

    function tick() {
      const diff = new Date(targetIso!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("已到开奖时间");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return remaining;
}

export type LotteryScreenConsoleProps = {
  eventId: string;
  eventName: string;
};

export function LotteryScreenConsole({
  eventId,
  eventName,
}: LotteryScreenConsoleProps) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const lotteryParam = searchParams.get("lottery");

  const [animating, setAnimating] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [tierAction, setTierAction] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  const { data: grandLottery, isLoading: lotteryLoading } = useQuery({
    queryKey: ["organizer-grand-lottery", eventId, lotteryParam],
    queryFn: () => fetchGrandLottery(eventId, lotteryParam),
  });

  const lotteryId = lotteryParam ?? grandLottery?.id;

  const { data: state, isFetching } = useQuery({
    queryKey: ["lottery-screen-state", eventId, lotteryId],
    queryFn: () => fetchScreenState(eventId, lotteryId!),
    enabled: Boolean(lotteryId),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (state?.lottery.status === "DRAWING") {
      setStarted(true);
    }
  }, [state?.lottery.status]);

  const countdown = useCountdown(state?.lottery.draw_at ?? null);

  const animationMeta = useMemo(
    () =>
      SCREEN_ANIMATION_OPTIONS.find(
        (o) => o.value === state?.lottery.animation,
      ),
    [state?.lottery.animation],
  );

  const previewUrl = lotteryId
    ? `/events/${eventId}/screen/lottery-display?lottery=${lotteryId}`
    : null;

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: ["lottery-screen-state", eventId, lotteryId],
    });
  }

  async function startAnimation() {
    if (!lotteryId) return;
    setAnimating(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/start-screen`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "启动失败");
      setStarted(true);
      toast.success("大屏动画已启动");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "启动失败");
    } finally {
      setAnimating(false);
    }
  }

  async function revealWinner() {
    if (!lotteryId) return;
    setRevealing(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/reveal-winner`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "揭晓失败");
      toast.success(`恭喜 ${json.data.winner.name} 获得 ${json.data.winner.prize_name}`);
      if (json.data.finished) {
        toast.info("全部奖品已揭晓");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "揭晓失败");
    } finally {
      setRevealing(false);
    }
  }

  async function startTierDraw(tier: number) {
    if (!lotteryId) return;
    setTierAction(tier);
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/draw-tier`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, action: "start" }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "启动失败");
      setStarted(true);
      toast.success(`已开始 ${json.data.tier_label} 抽奖`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "启动失败");
    } finally {
      setTierAction(null);
    }
  }

  async function revealTierWinner(tier: number) {
    if (!lotteryId) return;
    setTierAction(tier);
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/draw-tier`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, action: "reveal" }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "揭晓失败");
      toast.success(
        `恭喜 ${json.data.winner.name} 获得 ${json.data.winner.prize_name}`,
      );
      if (json.data.tier_complete) {
        toast.info(`${json.data.tier_label} 已全部揭晓`);
      }
      if (json.data.finished) {
        toast.info("全部奖品已揭晓");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "揭晓失败");
    } finally {
      setTierAction(null);
    }
  }

  const isTierMode = state?.lottery.prize_draw_order === "ASC";
  const nextTier = state?.tiers.find((t) => t.is_next);
  const activeTierState = state?.tiers.find((t) => t.is_active);

  async function endCeremony() {
    if (!lotteryId) return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/reveal-winner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end: true }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "结束失败");
      toast.success("闭幕抽奖仪式已结束");
      setStarted(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "结束失败");
    }
  }

  const statusLabel =
    state?.lottery.status === "DRAWING"
      ? "开奖中"
      : state?.lottery.status === "OPEN"
        ? "报名中"
        : state?.lottery.status === "FINISHED"
          ? "已结束"
          : "草稿";

  return (
    <AdminPage>
      <AdminHeader
        title="大屏开奖控制台"
        description={eventName}
        breadcrumb={["互动管理", "大屏抽奖", "开奖控制台"]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/events/${eventId}/lottery/big-screen`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft className="mr-1.5 size-4" />
              返回列表
            </Link>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink className="mr-1.5 size-4" />
                新窗口投影
              </a>
            )}
          </div>
        }
      />

      <AdminContent>
        {lotteryLoading ? (
          <p className="py-16 text-center text-text-muted">加载中…</p>
        ) : !lotteryId ? (
          <div className="rounded-lg border border-dashed border-border bg-surface py-20 text-center shadow-sm">
            <Trophy className="mx-auto size-12 text-text-tertiary/60" />
            <p className="mt-4 text-text-secondary">请先创建并发布大屏抽奖</p>
            <Link
              href={`/events/${eventId}/lottery/big-screen`}
              className={buttonVariants({ variant: "link", size: "sm", className: "mt-4" })}
            >
              前往大屏抽奖列表 →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <div className="space-y-6">
                <SectionCard title="主控制区" description="闭幕仪式抽奖节奏控制">
                  <div className="space-y-5 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        className={cn(
                          "font-normal",
                          state?.lottery.status === "DRAWING"
                            ? "bg-brand-green-light text-brand-green"
                            : "bg-brand-amber-light text-brand-amber",
                        )}
                      >
                        {statusLabel}
                      </Badge>
                      {animationMeta && (
                        <span className="text-sm text-text-muted">
                          {animationMeta.emoji} {animationMeta.title}
                        </span>
                      )}
                      {isFetching && (
                        <Loader2 className="size-4 animate-spin text-text-muted" />
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                        <p className="text-xs text-text-secondary">参与人数</p>
                        <p className="text-3xl font-bold tabular-nums text-brand-green">
                          {state?.lottery.entry_count ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                        <p className="text-xs text-text-secondary">已揭晓</p>
                        <p className="text-3xl font-bold tabular-nums text-text-primary">
                          {state?.revealed_count ?? 0}
                          <span className="text-lg text-text-secondary">
                            /{state?.winner_quota ?? "?"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {countdown && (
                      <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-center">
                        <p className="text-xs text-brand-gold">距计划开奖</p>
                        <p className="font-mono text-3xl font-bold text-brand-gold">
                          {countdown}
                        </p>
                      </div>
                    )}

                    {!isTierMode && !started && state?.lottery.status !== "DRAWING" && (
                      <Button
                        className="h-14 w-full bg-brand-gold text-lg font-semibold text-white hover:bg-brand-gold/90"
                        disabled={animating || state?.lottery.status !== "OPEN"}
                        onClick={() => void startAnimation()}
                      >
                        {animating ? (
                          <Loader2 className="mr-2 size-5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 size-5" />
                        )}
                        开始抽奖动画
                      </Button>
                    )}

                    {isTierMode && state?.lottery.status !== "FINISHED" && (
                      <div className="space-y-3">
                        {!started && state?.lottery.status !== "DRAWING" && (
                          <Button
                            className="h-12 w-full bg-brand-blue text-white hover:bg-brand-blue/90"
                            disabled={animating || state?.lottery.status !== "OPEN"}
                            onClick={() => void startAnimation()}
                          >
                            {animating ? (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 size-4" />
                            )}
                            初始化大屏（同步参与名单）
                          </Button>
                        )}

                        {state?.tiers && state.tiers.length > 0 && (
                          <div className="space-y-2 rounded-xl border border-border-light p-3">
                            {state.tiers.map((tier) => (
                              <div
                                key={tier.tier}
                                className={cn(
                                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                                  tier.complete && "bg-brand-green-light/40 text-brand-green",
                                  tier.is_active && "bg-brand-gold/15 ring-1 ring-brand-gold/40",
                                  tier.is_next && !tier.complete && "bg-brand-blue-light/30",
                                )}
                              >
                                <span>
                                  {tierMedal(tier.tier)} {tier.label}
                                  <span className="ml-2 text-xs text-text-muted">
                                    {tier.prize_name} × {tier.quantity}
                                  </span>
                                </span>
                                <span className="text-xs text-text-muted">
                                  {tier.drawn_count}/{tier.quantity}
                                  {tier.complete && " · 已完成"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {nextTier && state?.active_tier == null && (
                          <Button
                            className="h-14 w-full bg-brand-gold text-lg font-semibold text-white hover:bg-brand-gold/90"
                            disabled={tierAction != null}
                            onClick={() => void startTierDraw(nextTier.tier)}
                          >
                            {tierAction === nextTier.tier ? (
                              <Loader2 className="mr-2 size-5 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 size-5" />
                            )}
                            开始{nextTier.label}抽奖
                          </Button>
                        )}

                        {activeTierState && !activeTierState.complete && (
                          <Button
                            className="h-14 w-full bg-brand-gold text-lg font-semibold text-white hover:bg-brand-gold/90"
                            disabled={tierAction != null}
                            onClick={() => void revealTierWinner(activeTierState.tier)}
                          >
                            {tierAction === activeTierState.tier ? (
                              <Loader2 className="mr-2 size-5 animate-spin" />
                            ) : (
                              <Trophy className="mr-2 size-5" />
                            )}
                            揭晓{activeTierState.label}中奖者
                            {activeTierState.quantity > 1 &&
                              ` (${activeTierState.drawn_count + 1}/${activeTierState.quantity})`}
                          </Button>
                        )}

                        {(started || state?.lottery.status === "DRAWING") && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => void endCeremony()}
                          >
                            结束仪式
                          </Button>
                        )}
                      </div>
                    )}

                    {!isTierMode &&
                      (started || state?.lottery.status === "DRAWING") &&
                      state?.lottery.status !== "FINISHED" && (
                        <div className="space-y-3">
                          <Button
                            className="h-14 w-full bg-brand-gold text-lg font-semibold text-white hover:bg-brand-gold/90"
                            disabled={revealing}
                            onClick={() => void revealWinner()}
                          >
                            {revealing ? (
                              <Loader2 className="mr-2 size-5 animate-spin" />
                            ) : (
                              <Trophy className="mr-2 size-5" />
                            )}
                            揭晓中奖者
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => void endCeremony()}
                          >
                            结束仪式
                          </Button>
                        </div>
                      )}

                    {state?.lottery.status === "FINISHED" && (
                      <p className="text-center text-sm text-brand-green">
                        本场抽奖已全部完成
                      </p>
                    )}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="大屏预览" description="参会者看到的投影画面">
                <div className="p-3">
                  {previewUrl ? (
                    <iframe
                      title="大屏预览"
                      src={previewUrl}
                      className="aspect-video w-full rounded-lg border border-border-light bg-[#0a0a12]"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-lg bg-gray-100 text-sm text-text-muted">
                      暂无预览
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="中奖名单"
              description="按揭晓顺序展示，从小奖到大奖"
            >
              <div className="divide-y divide-border-light">
                {state?.winners.length === 0 ? (
                  <p className="p-8 text-center text-sm text-text-muted">
                    尚未揭晓中奖者
                  </p>
                ) : (
                  state?.winners.map((w, index) => (
                    <div
                      key={w.id}
                      className="flex flex-wrap items-center gap-4 px-5 py-4"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-sm font-bold text-brand-gold">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{w.name}</p>
                        <p className="text-sm text-text-muted">
                          {w.company ?? "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-brand-gold">
                          {w.prize_name}
                        </p>
                        {w.verification_code && (
                          <p className="font-mono text-xs text-text-muted">
                            核销码 {w.verification_code}
                          </p>
                        )}
                      </div>
                      <p className="w-full text-xs text-text-muted sm:w-auto">
                        {w.pickup_note}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
