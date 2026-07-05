"use client";

import { Trophy } from "lucide-react";
import { AnimatedPercentage } from "@/components/bigscreen/AnimatedPercentage";
import { cn } from "@/lib/utils";

type PollVotingBarProps = {
  label: string;
  percentage: number;
  isWinner: boolean;
};

/** PR5 · 条形赛跑单行 */
export function PollVotingBar({
  label,
  percentage,
  isWinner,
}: PollVotingBarProps) {
  const fillWidth =
    percentage <= 0 ? 0 : Math.min(100, Math.max(percentage, 6));

  return (
    <div className="flex items-center gap-[clamp(12px,2vw,24px)]">
      <p
        className={cn(
          "w-[clamp(120px,24%,280px)] shrink-0 truncate text-right text-[clamp(15px,1.5vw,22px)] font-medium leading-snug",
          isWinner ? "text-white" : "text-white/85",
        )}
        title={label}
      >
        {label}
      </p>

      <div
        className={cn(
          "relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-white/[0.07] transition-shadow duration-500",
          "h-[clamp(44px,5.5vh,64px)]",
          isWinner &&
            "ring-2 ring-[#fbbf24]/90 shadow-[0_0_28px_rgba(251,191,36,0.35)]",
        )}
      >
        {fillWidth > 0 ? (
          <div
            className="absolute inset-y-0 left-0 flex items-center justify-end gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] via-[#22c55e] to-[#2dd4bf] px-[clamp(12px,1.5vw,20px)] transition-[width] duration-700 ease-out"
            style={{ width: `${fillWidth}%` }}
          >
            {isWinner && (
              <Trophy
                className="size-[clamp(16px,1.8vw,22px)] shrink-0 text-[#fde68a] drop-shadow-sm"
                aria-hidden
              />
            )}
            <AnimatedPercentage
              value={percentage}
              className="text-[clamp(15px,1.7vw,24px)] font-bold tabular-nums text-white"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
