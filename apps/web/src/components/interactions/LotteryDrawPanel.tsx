"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";
import {
  parsePrizes,
  prizeRankBadgeClass,
  prizeRankLabel,
} from "@/lib/lottery-types";
import { cn } from "@/lib/utils";

type PrizeDrawState = "PENDING" | "DRAWING" | "DONE";

type WinnerInfo = {
  id: string;
  userId: string;
  prizeRank: number;
  prizeName: string;
  name: string;
  avatarUrl: string | null;
};

type LotteryDrawPanelProps = {
  eventId: string;
  lotteryId: string;
  title: string;
  entryCount: number;
  prizes: unknown;
  onClose?: () => void;
  onFinished?: () => void;
};

export function LotteryDrawPanel({
  eventId,
  lotteryId,
  title,
  entryCount,
  prizes: rawPrizes,
  onFinished,
}: LotteryDrawPanelProps) {
  const prizes = parsePrizes(rawPrizes).sort((a, b) => b.rank - a.rank);
  const [states, setStates] = useState<Record<number, PrizeDrawState>>({});
  const [winnersByRank, setWinnersByRank] = useState<
    Record<number, WinnerInfo[]>
  >({});

  useEffect(() => {
    void loadWinners();
  }, [eventId, lotteryId]);

  async function loadWinners() {
    try {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lotteryId}/winners`,
      );
      if (!res.ok) return;
      const json = await res.json();
      const winners = json.data as WinnerInfo[];
      const byRank: Record<number, WinnerInfo[]> = {};
      const nextStates: Record<number, PrizeDrawState> = {};
      for (const prize of prizes) {
        const matched = winners.filter((w) => w.prizeRank === prize.rank);
        if (matched.length > 0) {
          byRank[prize.rank] = matched;
          nextStates[prize.rank] = "DONE";
        } else {
          nextStates[prize.rank] = "PENDING";
        }
      }
      setWinnersByRank(byRank);
      setStates(nextStates);
    } catch {
      /* ignore */
    }
  }

  const drawPrize = useCallback(
    async (prize: LotteryPrizeConfig) => {
      setStates((s) => ({ ...s, [prize.rank]: "DRAWING" }));
      try {
        const res = await fetch(
          `/api/events/${eventId}/lotteries/${lotteryId}/draw`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prize_rank: prize.rank,
              count: prize.count ?? 1,
            }),
          },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message ?? "抽取失败");
        }
        const json = await res.json();
        const winners = json.data as WinnerInfo[];
        setWinnersByRank((prev) => ({ ...prev, [prize.rank]: winners }));
        setStates((s) => ({ ...s, [prize.rank]: "DONE" }));
        toast.success(`${prizeRankLabel(prize.rank)} 抽取完成`);
      } catch (e) {
        setStates((s) => ({ ...s, [prize.rank]: "PENDING" }));
        toast.error(e instanceof Error ? e.message : "抽取失败");
      }
    },
    [eventId, lotteryId],
  );

  const allDone = prizes.every((p) => states[p.rank] === "DONE");

  useEffect(() => {
    if (allDone && prizes.length > 0) {
      onFinished?.();
    }
  }, [allDone, prizes.length, onFinished]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto border-l border-border-light px-6 py-5">
      <h2 className="text-lg font-bold text-brand-red">🎲 抽奖进行中</h2>
      <p className="mt-1 text-sm text-text-muted">
        {entryCount} 人参与 · 共 {prizes.length} 个奖项
      </p>
      <p className="text-xs text-text-muted">{title}</p>

      <div className="mt-4 space-y-2">
        {prizes.map((prize) => {
          const state = states[prize.rank] ?? "PENDING";
          const winners = winnersByRank[prize.rank] ?? [];

          return (
            <div
              key={prize.rank}
              className={cn(
                "flex items-center rounded-xl border border-border-light bg-white p-4",
                state === "DONE" && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "mr-3 shrink-0 rounded px-2 py-0.5 text-xs font-bold",
                  prizeRankBadgeClass(prize.rank),
                )}
              >
                {prizeRankLabel(prize.rank)}
              </span>
              <span className="flex-1 text-sm font-medium">
                {prize.prize || prize.name}
              </span>
              <span className="mr-2 text-xs text-text-muted">
                × {prize.count ?? 1}
              </span>

              {state === "PENDING" && (
                <Button
                  size="sm"
                  className="h-9 rounded-lg bg-brand-red px-5 text-sm text-white"
                  onClick={() => void drawPrize(prize)}
                >
                  抽取
                </Button>
              )}
              {state === "DRAWING" && (
                <Button
                  size="sm"
                  disabled
                  className="h-9 rounded-lg bg-gray-200 px-5 text-sm text-gray-400"
                >
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  抽取中…
                </Button>
              )}
              {state === "DONE" && (
                <div className="flex items-center gap-2">
                  {winners.slice(0, 3).map((w) => (
                    <Avatar key={w.id} className="size-5">
                      <AvatarFallback className="text-[8px]">
                        {w.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  <span className="text-xs text-brand-green">✓ 已抽取</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        className="mt-4 h-12 w-full rounded-xl bg-brand-red font-semibold text-white"
        onClick={() =>
          window.open(
            `/events/${eventId}/interactions/bigscreen?mode=lottery&lottery=${lotteryId}`,
            "_blank",
          )
        }
      >
        大屏开始 ↗
        <ExternalLink className="ml-2 size-4" />
      </Button>
      <p className="mt-1 text-center text-xs text-text-muted">
        在大屏上展示抽奖动效和中奖结果
      </p>
    </div>
  );
}
