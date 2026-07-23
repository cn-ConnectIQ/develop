"use client";

import { Trophy } from "lucide-react";
import { AnimatedPercentage } from "@/components/bigscreen/AnimatedPercentage";
import { cn } from "@/lib/utils";

type PollVotingBarProps = {
  label: string;
  percentage: number;
  isWinner: boolean;
};

/** PR5 · 条形赛跑单行 — 宽度 CSS 过渡，避免条件卸载造成闪烁 */
export function PollVotingBar({
  label,
  percentage,
  isWinner,
}: PollVotingBarProps) {
  const pct = Math.min(100, Math.max(0, percentage));
  // 有票时至少露出一点填充，便于看见增长；0 票保持真正空轨
  const fillWidth = pct <= 0 ? 0 : Math.max(pct, 6);

  return (
    <div className="flex items-center gap-[clamp(12px,2vw,24px)]">
      <p
        className={cn(
          "w-[clamp(120px,24%,280px)] shrink-0 truncate text-right text-[clamp(15px,1.5vw,22px)] font-medium leading-snug transition-colors duration-500",
          isWinner ? "text-white" : "text-white/85",
        )}
        title={label}
      >
        {label}
      </p>

      <div
        className={cn(
          "relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-white/[0.07]",
          "h-[clamp(44px,5.5vh,64px)]",
          "transition-[box-shadow,ring-color] duration-500 ease-out",
          isWinner &&
            "ring-2 ring-[#fbbf24]/90 shadow-[0_0_28px_rgba(251,191,36,0.35)]",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-end gap-2 rounded-2xl",
            "bg-gradient-to-r from-[#16a34a] via-[#22c55e] to-[#2dd4bf]",
            "px-[clamp(12px,1.5vw,20px)]",
            "will-change-[width]",
            "transition-[width,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          )}
          style={{
            width: `${fillWidth}%`,
            opacity: fillWidth > 0 ? 1 : 0,
          }}
        >
          <Trophy
            className={cn(
              "size-[clamp(16px,1.8vw,22px)] shrink-0 text-[#fde68a] drop-shadow-sm",
              "transition-opacity duration-500",
              isWinner ? "opacity-100" : "opacity-0",
            )}
            aria-hidden
          />
          <AnimatedPercentage
            value={pct}
            className={cn(
              "text-[clamp(15px,1.7vw,24px)] font-bold tabular-nums text-white",
              "transition-opacity duration-300",
              fillWidth > 0 ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      </div>
    </div>
  );
}
