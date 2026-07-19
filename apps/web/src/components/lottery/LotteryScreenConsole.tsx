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
import { Button } from "@/components/ui/button";
import { SCREEN_ANIMATION_OPTIONS, tierMedal } from "@/lib/lottery/organizer-lottery-config";
import type {
  OrganizerLotteryDto,
  PrizeDrawOrder,
} from "@/lib/lottery/organizer-lottery-config";
import type { LotteryTierState } from "@/lib/lottery/lottery-screen-service";
import { TierDrawControl, type TierDrawMode } from "@/components/lottery/TierDrawControl";
import { TierWinnersList } from "@/components/lottery/TierWinnersList";
import { withPublicPath } from "@/lib/public-path";
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
    allow_scan_join?: boolean;
  };
  scan_join?: {
    qr_url: string | null;
    scan_url: string;
    session_code: string;
  } | null;
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

  // iframe / 新窗口必须带 /uc，否则会打到域名根 COS → NoSuchKey 404
  const projectionUrl = lotteryId
    ? withPublicPath(
        `/events/${eventId}/screen/lottery-display?lottery=${lotteryId}`,
      )
    : null;
  const embedPreviewUrl = projectionUrl
    ? `${projectionUrl}${projectionUrl.includes("?") ? "&" : "?"}embed=1`
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

  async function drawTierWinners(tier: number, mode: TierDrawMode) {
    if (!lotteryId) return;
    setTierAction(tier);
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/draw-tier`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, action: "draw", mode }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "抽取失败");

      const drawn = json.data.thisDrawWinners as Array<{ name: string }>;
      if (drawn.length === 1) {
        toast.success(`恭喜 ${drawn[0]!.name} 中奖`);
      } else {
        toast.success(`已一次性抽出 ${drawn.length} 位获奖者`);
      }
      if (json.data.tier_complete) {
        toast.info(`${json.data.tier_label} 已全部揭晓`);
      }
      if (json.data.finished) {
        toast.info("全部奖品已揭晓");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "抽取失败");
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
      ? "进行中"
      : state?.lottery.status === "OPEN"
        ? "准备就绪"
        : state?.lottery.status === "FINISHED"
          ? "已结束"
          : "草稿";

  const focusTier = activeTierState ?? nextTier ?? state?.tiers.find((t) => !t.complete);
  const stepIndex =
    activeTierState && !activeTierState.complete
      ? 2
      : nextTier && state?.active_tier == null && started
        ? 1
        : 0;

  const primaryAction = (() => {
    if (!state || state.lottery.status === "FINISHED") return null;
    if (isTierMode) {
      if (!started && state.lottery.status !== "DRAWING") {
        return {
          label: "初始化大屏",
          onClick: () => void startAnimation(),
          disabled: animating || state.lottery.status !== "OPEN",
          loading: animating,
        };
      }
      if (nextTier && state.active_tier == null) {
        return {
          label: `开始${nextTier.label}抽奖`,
          onClick: () => void startTierDraw(nextTier.tier),
          disabled: tierAction != null,
          loading: tierAction === nextTier.tier,
        };
      }
      if (activeTierState && !activeTierState.complete) {
        return null;
      }
    }
    if (!started && state.lottery.status !== "DRAWING") {
      return {
        label: "开始抽奖",
        onClick: () => void startAnimation(),
        disabled: animating || state.lottery.status !== "OPEN",
        loading: animating,
      };
    }
    if (state.lottery.status === "DRAWING") {
      return {
        label: "揭晓中奖者",
        onClick: () => void revealWinner(),
        disabled: revealing,
        loading: revealing,
      };
    }
    return null;
  })();

  return (
    <div className="flex min-h-full flex-col bg-[#0F1117] text-white">
      <div className="flex h-[52px] shrink-0 items-center gap-4 border-b border-white/10 bg-[#161B27] px-7">
        <Link
          href={`/events/${eventId}/lottery/big-screen`}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回
        </Link>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-sm text-white/50">大屏抽奖控制台</span>
        <div className="flex-1" />
        <span className="truncate text-sm text-white/50">
          {eventName} · {state?.lottery.title ?? grandLottery?.title ?? "闭幕大抽奖"}
        </span>
        {projectionUrl && (
          <a
            href={projectionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            <ExternalLink className="size-3.5" />
            新窗口投影
          </a>
        )}
      </div>

      {lotteryLoading ? (
        <p className="flex flex-1 items-center justify-center text-white/50">加载中…</p>
      ) : !lotteryId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white/60">
          <Trophy className="size-12 opacity-40" />
          <p>请先创建并发布大屏抽奖</p>
          <Link
            href={`/events/${eventId}/lottery/big-screen`}
            className="text-sm text-brand-green hover:underline"
          >
            前往大屏抽奖列表 →
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-8 lg:p-9">
            {focusTier && (
              <div className="overflow-hidden rounded-2xl bg-[#1A2035]">
                <div className="flex flex-wrap items-center gap-5 px-7 py-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tierMedal(focusTier.tier)}</span>
                    <div>
                      <p className="text-sm text-white/50">当前开奖等级</p>
                      <p className="text-2xl font-extrabold text-brand-gold">{focusTier.label}</p>
                    </div>
                  </div>
                  <div className="hidden h-12 w-px bg-white/10 sm:block" />
                  <div>
                    <p className="text-sm text-white/50">奖品</p>
                    <p className="text-lg font-bold">
                      {focusTier.prize_name} × {focusTier.quantity}
                    </p>
                  </div>
                  {isTierMode && (
                    <>
                      <div className="hidden h-12 w-px bg-white/10 sm:block" />
                      <div>
                        <p className="text-sm text-white/50">抽取进度</p>
                        <p className="text-2xl font-extrabold text-white">
                          {focusTier.drawn_count}
                          <span className="text-lg font-medium text-white/40">
                            /{focusTier.quantity}
                          </span>
                        </p>
                      </div>
                    </>
                  )}
                  <div className="hidden h-12 w-px bg-white/10 sm:block" />
                  <div>
                    <p className="text-sm text-white/50">奖池人数</p>
                    <p className="text-2xl font-extrabold text-[#7DE0BE]">
                      {state?.lottery.entry_count ?? 0}
                      <span className="ml-1 text-sm font-medium">人</span>
                    </p>
                  </div>
                  {state?.scan_join?.qr_url && (
                    <>
                      <div className="hidden h-12 w-px bg-white/10 sm:block" />
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={state.scan_join.qr_url}
                          alt="扫码加入"
                          className="size-16 rounded-lg bg-white p-1"
                        />
                        <div>
                          <p className="text-sm text-white/50">扫码入池</p>
                          <p className="font-mono text-sm text-[#7DE0BE]">
                            {state.scan_join.session_code}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex-1" />
                  <div className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-4 py-2">
                    <span className="size-2 animate-pulse rounded-full bg-brand-gold shadow-[0_0_8px_#EF9F27]" />
                    <span className="text-sm font-semibold text-brand-gold">{statusLabel}</span>
                  </div>
                </div>

                {isTierMode && activeTierState && (
                  <div className="border-t border-white/10 px-7 py-5">
                    <TierDrawControl
                      embedded
                      tier={activeTierState}
                      drawing={tierAction === activeTierState.tier}
                      onDraw={(mode) => drawTierWinners(activeTierState.tier, mode)}
                    />
                  </div>
                )}

                {isTierMode &&
                  started &&
                  nextTier &&
                  state?.active_tier == null &&
                  !nextTier.complete && (
                    <div className="border-t border-white/10 px-7 py-4 text-sm text-white/50">
                      点击下方「开始{nextTier.label}抽奖」后，将在此选择
                      <span className="mx-1 text-[#7DE0BE]">逐个抽取</span>或
                      <span className="mx-1 text-[#D4D0FF]">一次性抽完</span>
                    </div>
                  )}

                {isTierMode &&
                  !started &&
                  state?.lottery.status === "OPEN" &&
                  nextTier &&
                  !nextTier.complete && (
                    <div className="border-t border-white/10 px-7 py-4 text-sm text-white/50">
                      先点击「初始化大屏」，再开始{nextTier.label}抽奖，即可在此选择抽取模式
                    </div>
                  )}
              </div>
            )}

            <div className="flex flex-col items-center gap-5 rounded-[20px] bg-[#1A2035] px-8 py-10">
              <p className="text-sm font-semibold text-white/50">
                动效：{animationMeta?.title ?? "摇号机"} · {statusLabel}
              </p>
              {primaryAction && (
                <Button
                  className="h-20 w-full max-w-xs rounded-[20px] bg-gradient-to-br from-brand-green to-[#0B8A69] text-2xl font-extrabold text-white shadow-[0_12px_40px_rgba(15,110,86,0.5),0_0_60px_rgba(15,110,86,0.2)] hover:from-brand-green/90 hover:to-[#0B8A69]/90"
                  disabled={primaryAction.disabled}
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.loading ? (
                    <Loader2 className="mr-2 size-6 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 size-6" />
                  )}
                  {primaryAction.label}
                </Button>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/40">
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5 font-semibold",
                    stepIndex === 0
                      ? "bg-brand-green/30 text-[#7DE0BE]"
                      : "border border-white/10",
                  )}
                >
                  ① 开始抽奖
                </span>
                <span className="text-white/20">→</span>
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5",
                    stepIndex === 1
                      ? "bg-brand-gold/20 font-semibold text-brand-gold"
                      : "border border-white/10",
                  )}
                >
                  ② 等待开奖中…
                </span>
                <span className="text-white/20">→</span>
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5",
                    stepIndex === 2
                      ? "bg-brand-gold/20 font-semibold text-brand-gold"
                      : "border border-white/10",
                  )}
                >
                  {isTierMode && activeTierState && !activeTierState.complete
                    ? "③ 选择模式并抽取"
                    : "③ 确认结果，进入下一等级"}
                </span>
              </div>
              {countdown && (
                <p className="font-mono text-lg text-brand-gold">距计划开奖 {countdown}</p>
              )}
              {isFetching && (
                <Loader2 className="size-4 animate-spin text-white/40" />
              )}
            </div>

            {isTierMode && activeTierState && state?.winners && (
              <TierWinnersList tier={activeTierState} winners={state.winners} />
            )}

            {state?.tiers && state.tiers.length > 0 && (
              <div className="rounded-2xl bg-[#1A2035] p-5">
                <p className="mb-3 text-sm font-semibold text-white/50">等级进度</p>
                <div className="space-y-2">
                  {state.tiers.map((tier) => (
                    <div
                      key={tier.tier}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm",
                        tier.complete && "bg-brand-green/10 text-[#7DE0BE]",
                        tier.is_active && "bg-brand-gold/10 ring-1 ring-brand-gold/30",
                        tier.is_next && !tier.complete && "bg-white/5",
                      )}
                    >
                      <span>
                        {tierMedal(tier.tier)} {tier.label}
                        <span className="ml-2 text-white/40">
                          {tier.prize_name}
                        </span>
                      </span>
                      <span className="text-white/50">
                        {tier.drawn_count}/{tier.quantity}
                        {tier.complete && " ✓"}
                      </span>
                    </div>
                  ))}
                </div>
                {(started || state.lottery.status === "DRAWING") &&
                  state.lottery.status !== "FINISHED" && (
                    <Button
                      variant="outline"
                      className="mt-4 w-full border-white/15 bg-transparent text-white/70 hover:bg-white/5"
                      onClick={() => void endCeremony()}
                    >
                      结束仪式
                    </Button>
                  )}
              </div>
            )}

            {state?.winners && state.winners.length > 0 && (
              <div className="rounded-2xl bg-[#1A2035] p-5">
                <p className="mb-3 text-sm font-semibold text-white/50">已揭晓中奖者</p>
                <div className="divide-y divide-white/10">
                  {state.winners.map((w, index) => (
                    <div key={w.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <span className="flex size-7 items-center justify-center rounded-full bg-brand-gold/15 text-xs font-bold text-brand-gold">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{w.name}</p>
                        <p className="text-white/40">{w.company ?? "—"}</p>
                      </div>
                      <p className="font-medium text-brand-gold">{w.prize_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="hidden min-h-0 w-[min(440px,40%)] shrink-0 flex-col border-l border-white/10 bg-[#12151F] p-5 xl:flex">
            <p className="mb-3 shrink-0 text-xs font-semibold tracking-widest text-white/40">
              大屏同步预览
            </p>
            {embedPreviewUrl ? (
              <iframe
                title="大屏预览"
                src={embedPreviewUrl}
                className="min-h-[360px] w-full flex-1 rounded-xl border border-white/10 bg-[#0D0D1F]"
                style={{ height: "min(520px, 58vh)" }}
              />
            ) : (
              <div
                className="flex w-full flex-1 items-center justify-center rounded-xl bg-[#0D0D1F] text-sm text-white/30"
                style={{ minHeight: "360px" }}
              >
                暂无预览
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-white/35">
              右侧小窗实时同步投影大屏画面，控制台操作与现场显示分离（BS9）。
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
