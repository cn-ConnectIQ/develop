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
import { Button } from "@/components/ui/button";
import { SCREEN_ANIMATION_OPTIONS } from "@/lib/lottery/organizer-lottery-config";
import type { OrganizerLotteryDto } from "@/lib/lottery/organizer-lottery-config";
import { cn } from "@/lib/utils";

type ScreenState = {
  lottery: {
    id: string;
    title: string;
    status: string;
    draw_at: string | null;
    entry_count: number;
    animation: string;
  };
  winner_quota: number;
  revealed_count: number;
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

async function fetchGrandLottery(eventId: string) {
  const res = await fetch(
    `/api/events/${eventId}/lotteries?scope=organizer_grand`,
  );
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
  const [started, setStarted] = useState(false);

  const { data: grandLottery, isLoading: lotteryLoading } = useQuery({
    queryKey: ["organizer-grand-lottery", eventId],
    queryFn: () => fetchGrandLottery(eventId),
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
        title="大屏开奖指挥中心"
        description={eventName}
        breadcrumb={["闭幕仪式", "大屏控制"]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/events/${eventId}/lottery`}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
            >
              <ArrowLeft className="size-4" />
              抽奖配置
            </Link>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
              >
                <ExternalLink className="size-4" />
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
          <div className="rounded-xl border border-dashed border-border-light py-20 text-center">
            <Trophy className="mx-auto size-12 text-text-muted/40" />
            <p className="mt-4 text-text-muted">请先配置并发布全场大抽奖</p>
            <Link
              href={`/events/${eventId}/lottery`}
              className="mt-4 inline-block text-sm text-brand-blue hover:underline"
            >
              前往配置 →
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
                      <div className="rounded-xl border border-border-light bg-brand-blue-light/20 p-4">
                        <p className="text-xs text-text-muted">参与人数</p>
                        <p className="text-3xl font-bold text-brand-blue">
                          {state?.lottery.entry_count ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border-light p-4">
                        <p className="text-xs text-text-muted">已揭晓</p>
                        <p className="text-3xl font-bold">
                          {state?.revealed_count ?? 0}
                          <span className="text-lg text-text-muted">
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

                    {!started && state?.lottery.status !== "DRAWING" && (
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

                    {(started || state?.lottery.status === "DRAWING") &&
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
