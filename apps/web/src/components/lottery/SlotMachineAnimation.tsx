"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type SlotBall = {
  initial: string;
  color: string;
  bg: string;
};

export type SlotMachineAnimationProps = {
  phase: "animating" | "pop" | "revealed";
  tierLabel?: string | null;
  entryCount?: number;
  compact?: boolean;
  balls?: SlotBall[];
  outletBall?: SlotBall;
  winner?: {
    name: string;
    company?: string | null;
    prize_name?: string;
  } | null;
};

const DEFAULT_BALLS: SlotBall[] = [
  { initial: "王", color: "#534AB7", bg: "#D4D0FF" },
  { initial: "陈", color: "#B77A12", bg: "#FFE4B5" },
  { initial: "赵", color: "#2E7D32", bg: "#C8E6C9" },
];

function Ball({
  ball,
  size,
  className,
  style,
}: {
  ball: SlotBall;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-extrabold shadow-[0_4px_14px_rgba(0,0,0,0.4)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.24,
        color: ball.color,
        background: `radial-gradient(circle at 35% 35%, #fff, ${ball.bg})`,
        ...style,
      }}
    >
      {ball.initial}
    </div>
  );
}

export function SlotMachineAnimation({
  phase,
  tierLabel,
  entryCount,
  compact = false,
  balls = DEFAULT_BALLS,
  outletBall,
  winner,
}: SlotMachineAnimationProps) {
  const drumW = compact ? 60 : 180;
  const drumH = compact ? 90 : 280;
  const innerBallSize = compact ? 18 : 50;
  const outletSize = compact ? 16 : 40;
  const displayOutlet =
    outletBall ??
    (winner
      ? {
          initial: winner.name.slice(0, 1),
          color: "#534AB7",
          bg: "#D4D0FF",
        }
      : { initial: "?", color: "#534AB7", bg: "#D4D0FF" });

  const showPop = phase === "pop" || phase === "revealed";
  const showRevealCard = phase === "revealed" && winner;

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col text-white",
        !compact && "min-h-[420px]",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(83,74,183,0.25)_0%,transparent_65%)]" />

      {tierLabel && !compact && (
        <div className="relative z-10 pt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold/15 px-5 py-1.5">
            <span className="size-2 animate-pulse rounded-full bg-brand-gold shadow-[0_0_10px_#EF9F27]" />
            <span className="text-base font-bold tracking-wide text-brand-gold">
              {tierLabel} · 抽奖中
            </span>
          </div>
        </div>
      )}

      {compact && tierLabel && (
        <p className="relative z-10 pt-3 text-center text-[11px] font-bold text-white/60">
          {tierLabel}抽奖中
        </p>
      )}

      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col items-center justify-center",
          compact ? "py-2" : "py-6",
        )}
      >
        {!showRevealCard ? (
          <>
            <div className="relative" style={{ width: drumW, height: drumH }}>
              <div
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-[90px] border-[3px] border-white/15 shadow-[0_0_60px_rgba(83,74,183,0.6),inset_0_0_40px_rgba(0,0,0,0.5)]"
                style={{
                  width: drumW,
                  height: drumH,
                  background:
                    "linear-gradient(180deg, rgba(60,60,120,0.9) 0%, rgba(30,30,70,0.95) 100%)",
                }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-[90px] bg-gradient-to-b from-white/10 to-transparent" />
                <div className="relative z-10 flex flex-col items-center gap-2.5">
                  {balls.slice(0, 3).map((ball, i) => (
                    <Ball
                      key={`${ball.initial}-${i}`}
                      ball={ball}
                      size={innerBallSize - (compact ? 0 : i * 3)}
                      className={phase === "animating" ? "animate-ciq-slot-float" : "opacity-40"}
                      style={
                        phase === "animating"
                          ? { animationDelay: `${i * 0.3}s`, animationDuration: `${1.4 + i * 0.2}s` }
                          : undefined
                      }
                    />
                  ))}
                </div>
                <div
                  className="absolute bottom-0 rounded-b-lg border-t-2 border-white/15 bg-[#0A0A1A]"
                  style={{
                    width: compact ? 28 : 56,
                    height: compact ? 8 : 18,
                  }}
                />
              </div>
            </div>

            <div className={cn("flex justify-center", compact ? "mt-1" : "mt-1.5")}>
              <Ball
                ball={displayOutlet}
                size={showPop ? (compact ? 28 : 72) : outletSize}
                className={cn(
                  showPop
                    ? "animate-ciq-slot-pop shadow-[0_0_40px_rgba(83,74,183,0.8)]"
                    : phase === "animating"
                      ? "animate-ciq-slot-drop"
                      : "",
                )}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center">
            <Ball
              ball={displayOutlet}
              size={compact ? 36 : 96}
              className="shadow-[0_0_48px_rgba(239,159,39,0.6)]"
            />
            {winner?.prize_name && (
              <p className="mt-4 text-sm uppercase tracking-[0.25em] text-brand-gold">
                {winner.prize_name}
              </p>
            )}
            <h2
              className={cn(
                "mt-3 font-black text-white",
                compact ? "text-lg" : "text-5xl md:text-6xl",
              )}
            >
              {winner?.name}
            </h2>
            {winner?.company && (
              <p className={cn("text-white/70", compact ? "text-xs" : "text-2xl")}>
                {winner.company}
              </p>
            )}
          </div>
        )}
      </div>

      {entryCount != null && !compact && phase === "animating" && (
        <div className="relative z-10 pb-7 text-center">
          <p className="text-base text-white/60">
            奖池人数{" "}
            <span className="text-2xl font-extrabold text-white">{entryCount}</span> 人
          </p>
        </div>
      )}
    </div>
  );
}
