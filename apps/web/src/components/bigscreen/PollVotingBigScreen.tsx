"use client";

import { AnimatedParticipantCount } from "@/components/bigscreen/AnimatedParticipantCount";
import { BigscreenJoinQr } from "@/components/bigscreen/BigscreenJoinQr";
import { CountdownRing } from "@/components/bigscreen/CountdownRing";
import { PollVotingBar } from "@/components/bigscreen/PollVotingBar";
import type { PollOptionResult } from "@/lib/bigscreen-types";

type PollVotingBigScreenProps = {
  title: string;
  total: number;
  options: PollOptionResult[];
  showResults: boolean;
  /** 剩余时间文案，如 07:55；无截止则不显示 */
  countdown?: string;
  closesAt?: string | null;
  createdAt?: string | null;
  scanUrl?: string | null;
  qrUrl?: string | null;
  wxacodeUrl?: string | null;
};

function getWinnerId(options: PollOptionResult[]): string | null {
  if (options.length === 0) return null;
  let maxPct = -1;
  let winnerId: string | null = null;
  for (const opt of options) {
    if (opt.percentage > maxPct) {
      maxPct = opt.percentage;
      winnerId = opt.id;
    }
  }
  return maxPct > 0 ? winnerId : null;
}

/** PR5 · 大屏版 16:9 · 条形赛跑 */
export function PollVotingBigScreen({
  title,
  total,
  options,
  showResults,
  countdown,
  closesAt = null,
  createdAt = null,
  scanUrl = null,
  qrUrl = null,
  wxacodeUrl = null,
}: PollVotingBigScreenProps) {
  const winnerId = getWinnerId(options);
  const sorted = [...options].sort((a, b) => b.percentage - a.percentage);
  const showCountdown = Boolean(countdown && countdown !== "--:--");

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(45,212,191,0.08) 0%, transparent 55%), #1a1d2e",
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-6 px-[5%] pt-[4%]">
        <div className="min-w-0 flex-1">
          <p className="text-[clamp(12px,1.1vw,15px)] text-white/45">
            现场投票 · 实时结果
          </p>
          <h1 className="mt-[clamp(12px,1.8vh,24px)] text-[clamp(26px,3.4vw,44px)] font-bold leading-snug text-white">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-start gap-5">
          <div className="flex flex-col items-end gap-3 pt-1">
            {showCountdown ? (
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <p className="text-[clamp(11px,1vw,13px)] text-white/45">
                    剩余时间
                  </p>
                  <p className="font-mono text-[clamp(22px,2.4vw,32px)] font-bold leading-none text-[#fbbf24]">
                    {countdown}
                  </p>
                </div>
                <CountdownRing
                  closesAt={closesAt}
                  startedAt={createdAt}
                  size={36}
                />
              </div>
            ) : null}
            <div className="text-right">
              <AnimatedParticipantCount
                value={total}
                className="block text-[clamp(40px,5vw,72px)] font-black leading-none tracking-tight text-[#2dd4bf]"
              />
              <p className="mt-1 text-[clamp(12px,1.1vw,15px)] text-white/45">
                人已参与
              </p>
            </div>
          </div>

          <BigscreenJoinQr
            wxacodeUrl={wxacodeUrl}
            scanUrl={scanUrl}
            qrUrl={qrUrl}
            size={120}
            caption="微信扫码参与"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(14px,2.2vh,24px)] px-[5%] py-[clamp(20px,3vh,48px)]">
        {!showResults ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="size-3 animate-pulse rounded-full bg-[#34d399]" />
            <p className="text-center text-[clamp(18px,2vw,26px)] text-white/40">
              投票进行中，结果暂不显示
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="size-3 animate-pulse rounded-full bg-[#34d399]" />
            <p className="text-center text-[clamp(18px,2vw,26px)] text-white/40">
              等待首个投票…
            </p>
          </div>
        ) : (
          sorted.map((opt) => (
            <PollVotingBar
              key={opt.id}
              label={opt.text}
              percentage={opt.percentage}
              isWinner={opt.id === winnerId}
            />
          ))
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between px-[5%] pb-[3%]">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-[#22c55e] text-[11px] font-bold text-white">
            C
          </span>
          <span className="text-[clamp(12px,1.1vw,14px)] font-medium text-white/55">
            玖莅
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#34d399] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[#34d399]" />
          </span>
          <span className="text-[clamp(12px,1.1vw,14px)] text-white/45">
            实时更新中 · 微信扫右上角码参与
          </span>
        </div>
      </footer>
    </div>
  );
}
