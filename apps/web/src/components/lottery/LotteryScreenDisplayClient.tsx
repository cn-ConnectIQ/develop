"use client";

import { useSearchParams } from "next/navigation";
import { Gift, Trophy } from "lucide-react";
import {
  LotteryAnimationDispatch,
  useLotteryScreenAnimation,
} from "@/components/screen/lottery-animations";

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
      embedded={embedded}
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
          ? "relative flex h-full min-h-0 flex-col overflow-hidden text-white"
          : "relative flex min-h-screen flex-col overflow-hidden bg-[#1A1A2E] text-white"
      }
    >
      {!embedded && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1a3e_0%,_#0a0a12_60%)]" />
      )}

      <header className="relative z-10 flex items-center justify-between px-8 py-4">
        <div>
          {!embedded && <p className="text-sm text-white/40">{eventName}</p>}
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/40">参与人数</p>
          <p className="text-3xl font-black text-brand-gold">{entryCount}</p>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 pb-16">
        {screenPhase === "idle" && (
          <div className="text-center">
            <Gift className="mx-auto size-20 text-brand-gold/40" />
            <p className="mt-6 text-2xl text-white/50">等待控制台启动抽奖…</p>
            <p className="mt-2 text-sm text-white/30">
              频道 event:{eventId.slice(-6)}:lottery-screen
            </p>
          </div>
        )}

        {animationProps && (
          <LotteryAnimationDispatch
            animationType={animationType}
            props={animationProps}
            extras={dispatchExtras}
          />
        )}

        {screenPhase === "ended" && (
          <div className="text-center">
            <Trophy className="mx-auto size-24 text-brand-gold" />
            <h2 className="mt-6 text-4xl font-bold">抽奖圆满落幕</h2>
            <p className="mt-2 text-white/50">共揭晓 {winners.length} 位中奖者</p>
          </div>
        )}
      </main>

      {winners.length > 0 && screenPhase !== "idle" && (
        <footer className="relative z-10 border-t border-white/10 px-8 py-4">
          <p className="mb-2 text-xs text-white/40">
            已揭晓 {progress.revealed}/{progress.quota || "?"}
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {winners.map((w) => (
              <div
                key={w.id}
                className="shrink-0 rounded-lg bg-white/5 px-4 py-2 text-sm"
              >
                <span className="font-medium">{w.name}</span>
                <span className="mx-2 text-white/30">·</span>
                <span className="text-brand-gold">{w.prize_name}</span>
              </div>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
