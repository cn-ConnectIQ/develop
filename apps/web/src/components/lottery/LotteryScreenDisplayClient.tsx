"use client";

import { useSearchParams } from "next/navigation";
import { Gift, Trophy } from "lucide-react";
import {
  LotteryAnimationDispatch,
  useLotteryScreenAnimation,
} from "@/components/screen/lottery-animations";
import { cn } from "@/lib/utils";

export type LotteryScreenDisplayClientProps = {
  eventId: string;
  eventName: string;
  lotteryId?: string | null;
  embedded?: boolean;
};

export function LotteryScreenDisplayClient({
  eventId,
  eventName,
  lotteryId: lotteryIdProp,
  embedded = false,
}: LotteryScreenDisplayClientProps) {
  const searchParams = useSearchParams();
  const lotteryId = lotteryIdProp ?? searchParams.get("lottery");
  const isEmbedPreview =
    embedded || searchParams.get("embed") === "1";

  if (!lotteryId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/50">
        未指定抽奖活动
      </div>
    );
  }

  return (
    <LotteryScreenDisplayInner
      eventId={eventId}
      eventName={eventName}
      lotteryId={lotteryId}
      embedded={isEmbedPreview}
    />
  );
}

function LotteryScreenDisplayInner({
  eventId,
  eventName,
  lotteryId,
  embedded,
}: {
  eventId: string;
  eventName: string;
  lotteryId: string;
  embedded: boolean;
}) {
  const {
    screenPhase,
    animationType,
    animationProps,
    title,
    entryCount,
    winners,
    progress,
    loading,
    error,
    dispatchExtras,
  } = useLotteryScreenAnimation(eventId, lotteryId);

  if (loading) {
    return (
      <div
        className={
          embedded
            ? "flex h-full items-center justify-center text-white/50"
            : "flex min-h-screen items-center justify-center text-white/50"
        }
      >
        加载抽奖大屏…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={
          embedded
            ? "flex h-full items-center justify-center text-white/60"
            : "flex min-h-screen items-center justify-center text-white/60"
        }
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a12] text-white"
          : "relative flex min-h-screen flex-col overflow-hidden bg-[#1A1A2E] text-white"
      }
    >
      {!embedded && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1a3e_0%,_#0a0a12_60%)]" />
      )}

      <header
        className={cn(
          "relative z-10 flex shrink-0 items-center justify-between",
          embedded ? "gap-3 px-3 py-2" : "px-8 py-4",
        )}
      >
        <div className="min-w-0">
          {!embedded && <p className="text-sm text-white/40">{eventName}</p>}
          <h1
            className={cn(
              "font-bold leading-tight",
              embedded ? "truncate text-sm" : "text-2xl",
            )}
          >
            {title}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <p className={embedded ? "text-[10px] text-white/40" : "text-sm text-white/40"}>
            参与人数
          </p>
          <p
            className={cn(
              "font-black text-brand-gold",
              embedded ? "text-lg leading-none" : "text-3xl",
            )}
          >
            {entryCount}
          </p>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden",
          embedded ? "px-2 py-1" : "px-8 pb-16",
        )}
      >
        {screenPhase === "idle" && (
          <div className="text-center">
            <Gift
              className={cn(
                "mx-auto text-brand-gold/40",
                embedded ? "size-10" : "size-20",
              )}
            />
            <p
              className={cn(
                "text-white/50",
                embedded ? "mt-2 text-xs" : "mt-6 text-2xl",
              )}
            >
              等待控制台启动抽奖…
            </p>
            {!embedded && (
              <p className="mt-2 text-sm text-white/30">
                频道 event:{eventId.slice(-6)}:lottery-screen
              </p>
            )}
          </div>
        )}

        {animationProps && (
          <div
            className={cn(
              "flex w-full items-center justify-center",
              embedded && "max-h-full origin-top scale-[0.52] sm:scale-[0.58]",
            )}
          >
            <LotteryAnimationDispatch
              animationType={animationType}
              props={animationProps}
              extras={dispatchExtras}
            />
          </div>
        )}

        {screenPhase === "ended" && (
          <div className="text-center">
            <Trophy
              className={cn(
                "mx-auto text-brand-gold",
                embedded ? "size-12" : "size-24",
              )}
            />
            <h2
              className={cn(
                "font-bold",
                embedded ? "mt-3 text-lg" : "mt-6 text-4xl",
              )}
            >
              抽奖圆满落幕
            </h2>
            <p className={cn("text-white/50", embedded ? "mt-1 text-xs" : "mt-2")}>
              共揭晓 {winners.length} 位中奖者
            </p>
          </div>
        )}
      </main>

      {winners.length > 0 && screenPhase !== "idle" && (
        <footer
          className={cn(
            "relative z-10 shrink-0 border-t border-white/10",
            embedded ? "px-2 py-2" : "px-8 py-4",
          )}
        >
          <p className={cn("text-white/40", embedded ? "mb-1 text-[10px]" : "mb-2 text-xs")}>
            已揭晓 {progress.revealed}/{progress.quota || "?"}
          </p>
          {!embedded && (
            <div className="space-y-3">
              {Object.entries(
                winners.reduce<Record<number, typeof winners>>((acc, w) => {
                  const key = w.prize_rank;
                  acc[key] = acc[key] ? [...acc[key], w] : [w];
                  return acc;
                }, {}),
              ).map(([rank, group]) => (
                <div key={rank}>
                  <p className="mb-1 text-xs text-brand-gold/80">
                    {group[0]?.prize_name ?? `${rank}等奖`}（{group.length} 位）
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.map((w) => (
                      <div
                        key={w.id}
                        className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium">{w.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
