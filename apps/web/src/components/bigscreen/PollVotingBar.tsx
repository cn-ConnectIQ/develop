"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type PollVotingBarProps = {
  label: string;
  percentage: number;
  isWinner: boolean;
};

export function PollVotingBar({
  label,
  percentage,
  isWinner,
}: PollVotingBarProps) {
  const fillWidth = percentage > 0 ? Math.max(percentage, 10) : 0;

  return (
    <div
      className={cn(
        "rounded-2xl p-1 transition-shadow duration-500",
        isWinner &&
          "ring-2 ring-[#fbbf24] shadow-[0_0_24px_rgba(251,191,36,0.35)]",
      )}
    >
      <p className="mb-2.5 truncate text-[clamp(16px,1.6vw,22px)] font-medium text-white/90">
        {label}
      </p>
      <div className="relative h-[clamp(44px,5.5vh,60px)] overflow-hidden rounded-xl bg-white/[0.08]">
        <div
          className="absolute inset-y-0 left-0 flex items-center rounded-xl bg-gradient-to-r from-[#2dd4bf] to-[#34d399] px-4 transition-[width] duration-700 ease-out"
          style={{ width: `${fillWidth}%` }}
        >
          <span className="flex items-center gap-2 text-[clamp(16px,1.8vw,24px)] font-bold tabular-nums text-white">
            {isWinner && (
              <Trophy className="size-[clamp(18px,2vw,24px)] shrink-0 text-[#fde68a]" />
            )}
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}
