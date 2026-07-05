"use client";

import { AnimatedParticipantCount } from "@/components/bigscreen/AnimatedParticipantCount";
import { PollVotingBar } from "@/components/bigscreen/PollVotingBar";
import type { PollOptionResult } from "@/lib/bigscreen-types";

type PollVotingBigScreenProps = {
  title: string;
  total: number;
  options: PollOptionResult[];
  showResults: boolean;
};

function getWinnerIndex(options: PollOptionResult[]): number {
  if (options.length === 0) return -1;
  let maxPct = -1;
  let maxIdx = -1;
  options.forEach((opt, i) => {
    if (opt.percentage > maxPct) {
      maxPct = opt.percentage;
      maxIdx = i;
    }
  });
  return maxPct > 0 ? maxIdx : -1;
}

export function PollVotingBigScreen({
  title,
  total,
  options,
  showResults,
}: PollVotingBigScreenProps) {
  const winnerIdx = getWinnerIndex(options);
  const sorted = [...options].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#12121e] text-white">
      <header className="flex shrink-0 items-start justify-between px-[5%] pt-[4%]">
        <p className="text-[clamp(12px,1.1vw,15px)] text-white/45">
          现场投票 · 实时结果
        </p>
        <div className="text-right">
          <AnimatedParticipantCount
            value={total}
            className="block text-[clamp(48px,6vw,80px)] font-black leading-none tracking-tight text-[#2dd4bf]"
          />
          <p className="mt-1 text-[clamp(12px,1.1vw,15px)] text-white/45">
            人已参与
          </p>
        </div>
      </header>

      <h1 className="shrink-0 px-[5%] pt-[clamp(16px,2.5vh,32px)] text-center text-[clamp(24px,3.2vw,40px)] font-bold leading-snug text-white">
        {title}
      </h1>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(12px,2vh,20px)] px-[5%] py-[clamp(16px,3vh,40px)]">
        {!showResults ? (
          <p className="text-center text-[clamp(18px,2vw,26px)] text-white/40">
            投票进行中，结果暂不显示
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-[clamp(18px,2vw,26px)] text-white/40">
            等待首个投票…
          </p>
        ) : (
          sorted.map((opt) => {
            const originalIdx = options.findIndex((o) => o.id === opt.id);
            return (
              <PollVotingBar
                key={opt.id}
                label={opt.text}
                percentage={opt.percentage}
                isWinner={originalIdx === winnerIdx}
              />
            );
          })
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between px-[5%] pb-[3%]">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white/80">
            CIQ
          </span>
          <span className="text-[clamp(12px,1.1vw,14px)] font-medium text-white/50">
            ConnectIQ
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-[#34d399]" />
          <span className="text-[clamp(12px,1.1vw,14px)] text-white/45">
            实时更新中 · 扫码参与
          </span>
        </div>
      </footer>
    </div>
  );
}
