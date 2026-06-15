"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Gift, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  getMaxPercentage,
  useBigscreenStore,
  type RollingPerson,
} from "@/stores/bigscreenStore";
import { prizeRankBadgeClass, prizeRankLabel } from "@/lib/lottery-types";

function LiveClock() {
  const [time, setTime] = useState(format(new Date(), "HH:mm:ss"));
  useEffect(() => {
    const t = setInterval(
      () => setTime(format(new Date(), "HH:mm:ss")),
      1000,
    );
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-xl text-white">{time}</span>;
}

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    setDisplay(value);
  }, [value]);
  return (
    <span className="text-[80px] font-black text-white transition-all duration-500">
      {display}
    </span>
  );
}

function SparkleParticles() {
  const dots = Array.from({ length: 12 });
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((_, i) => (
        <span
          key={i}
          className="absolute size-2 rounded-full bg-brand-gold"
          style={{
            left: `${50 + Math.cos((i / 12) * Math.PI * 2) * 45}%`,
            top: `${50 + Math.sin((i / 12) * Math.PI * 2) * 45}%`,
            animation: `pulse 1.2s ease-in-out ${i * 0.08}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function BigscreenProjection() {
  const eventName = useBigscreenStore((s) => s.eventName);
  const joinQrUrl = useBigscreenStore((s) => s.joinQrUrl);
  const currentMode = useBigscreenStore((s) => s.currentMode);
  const currentPoll = useBigscreenStore((s) => s.currentPoll);
  const pollResults = useBigscreenStore((s) => s.pollResults);
  const showResults = useBigscreenStore((s) => s.showResults);
  const featuredQna = useBigscreenStore((s) => s.featuredQna);
  const countdown = useBigscreenStore((s) => s.countdown);
  const lotteryTitle = useBigscreenStore((s) => s.lotteryTitle);
  const lotteryEntryCount = useBigscreenStore((s) => s.lotteryEntryCount);
  const lotteryQuota = useBigscreenStore((s) => s.lotteryQuota);
  const lotteryQrUrl = useBigscreenStore((s) => s.lotteryQrUrl);
  const rollingPerson = useBigscreenStore((s) => s.rollingPerson);
  const isRollingSettled = useBigscreenStore((s) => s.isRollingSettled);
  const currentWinner = useBigscreenStore((s) => s.currentWinner);
  const rollingEntries = useBigscreenStore((s) => s.rollingEntries);
  const isRollingPaused = useBigscreenStore((s) => s.isRollingPaused);
  const activePrizeRank = useBigscreenStore((s) => s.activePrizeRank);
  const lotteryPrizes = useBigscreenStore((s) => s.lotteryPrizes);
  const allWinners = useBigscreenStore((s) => s.allWinners);
  const setRollingPerson = useBigscreenStore((s) => s.setRollingPerson);

  const rollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePrize = lotteryPrizes.find((p) => p.rank === activePrizeRank);

  const options = pollResults?.options ?? [];
  const maxPct = getMaxPercentage(options);
  const wordCloud = pollResults?.wordCloud ?? [];
  const totalVotes = pollResults?.total ?? 0;

  const ratingAvg = useMemo(() => {
    if (!options.length) return 0;
    const sum = options.reduce(
      (acc, o, i) => acc + (i + 1) * o.count,
      0,
    );
    const count = options.reduce((acc, o) => acc + o.count, 0);
    return count > 0 ? sum / count : 0;
  }, [options]);

  useEffect(() => {
    if (
      currentMode !== "lottery_drawing" ||
      isRollingSettled ||
      isRollingPaused ||
      rollingEntries.length === 0
    ) {
      if (rollRef.current) clearInterval(rollRef.current);
      return;
    }

    let delay = 50;
    let step = 0;

    function tick() {
      const pick =
        rollingEntries[Math.floor(Math.random() * rollingEntries.length)];
      setRollingPerson(pick);
      step += 1;
      if (step > 40 && step % 3 === 0) delay = Math.min(delay + 25, 500);
      if (rollRef.current) clearInterval(rollRef.current);
      rollRef.current = setInterval(tick, delay);
    }

    rollRef.current = setInterval(tick, delay);
    return () => {
      if (rollRef.current) clearInterval(rollRef.current);
    };
  }, [
    currentMode,
    isRollingSettled,
    isRollingPaused,
    rollingEntries,
    setRollingPerson,
  ]);

  const displayPerson: RollingPerson | null =
    currentWinner ?? rollingPerson;

  return (
    <div className="relative flex-[0_0_72%] overflow-hidden bg-[#1A1A2E]">
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-10 pt-8">
        <span className="text-sm text-white/50">{eventName}</span>
        <LiveClock />
      </div>

      {currentMode === "idle" && (
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-4xl font-black text-white">ConnectIQ</p>
          <p className="mt-4 text-2xl font-bold text-white">扫码加入</p>
          <div className="mt-6 flex size-[200px] items-center justify-center rounded-xl bg-white p-3">
            {joinQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={joinQrUrl}
                alt="扫码加入"
                className="size-full object-contain"
              />
            ) : (
              <span className="text-center text-xs text-text-muted">
                二维码
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-white/50">用手机扫描</p>
        </div>
      )}

      {currentMode === "poll" && currentPoll && (
        <div className="flex h-full flex-col pb-20">
          <span className="mx-auto mt-12 block w-fit rounded-full bg-brand-blue px-4 py-1.5 text-sm text-white">
            ● 投票进行中
          </span>
          <h1 className="mt-6 px-16 text-center text-[30px] font-bold leading-tight text-white">
            {currentPoll.title}
          </h1>
          {showResults && (
            <div className="mt-8 space-y-4 px-12">
              {options.map((opt, index) => (
                <div key={opt.id} className="flex items-center gap-4">
                  <span className="w-8 shrink-0 text-[18px] text-white/40">
                    {index + 1}
                  </span>
                  <span className="min-w-[160px] text-[18px] text-white">
                    {opt.text}
                  </span>
                  <div className="relative h-[52px] flex-1 rounded-xl bg-white/10">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-xl bg-gradient-to-r from-[#185FA5] to-[#3B82F6] transition-all duration-700",
                        opt.percentage === maxPct &&
                          maxPct > 0 &&
                          "outline outline-2 outline-[#EF9F27]",
                      )}
                      style={{ width: `${Math.max(opt.percentage, 2)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[20px] font-bold text-white">
                    {opt.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
          {!showResults && (
            <p className="mt-12 text-center text-xl text-white/50">
              投票进行中，结果暂不显示
            </p>
          )}
          <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-10 py-4">
            <span className="text-sm text-white/60">{totalVotes} 人已投票</span>
            {countdown !== "--:--" && (
              <span className="font-mono text-[28px] font-bold text-brand-amber">
                {countdown}
              </span>
            )}
            <span className="text-xs text-white/30">ConnectIQ</span>
          </footer>
        </div>
      )}

      {currentMode === "qna" && (
        <div className="flex h-full flex-col items-center px-8 pb-16 pt-20">
          <p className="text-center text-[14px] text-white/60">问答环节</p>
          <div className="mx-16 mt-6 w-full max-w-4xl rounded-3xl bg-white/10 p-10 backdrop-blur-sm">
            <p className="text-[30px] font-bold leading-tight text-white">
              {featuredQna?.text ?? "等待问题上屏…"}
            </p>
            {featuredQna ? (
              <div className="mt-6 flex items-center gap-3 text-[15px] text-white/70">
                <Avatar className="size-10 border border-white/20">
                  <AvatarFallback>问</AvatarFallback>
                </Avatar>
                <span>现场提问</span>
              </div>
            ) : (
              <p className="mt-6 text-white/50">匿名提问</p>
            )}
          </div>
        </div>
      )}

      {currentMode === "wordcloud" && (
        <div className="flex h-full flex-col px-12 pb-16 pt-24">
          {currentPoll && (
            <h2 className="mb-8 text-center text-[28px] font-bold text-white">
              {currentPoll.title}
            </h2>
          )}
          <div className="flex flex-1 flex-wrap items-center justify-center gap-4">
            {wordCloud.map((w) => (
              <span
                key={w.text}
                className="font-medium text-white transition-opacity duration-500"
                style={{
                  fontSize: Math.min(60, 12 + w.count * 4),
                  opacity: w.count > 2 ? 1 : 0.5,
                }}
              >
                {w.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {currentMode === "rating" && currentPoll && (
        <div className="flex h-full flex-col items-center px-16 pt-16">
          <h2 className="text-center text-[28px] font-bold text-white">
            {currentPoll.title}
          </h2>
          <div className="mt-8 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  "size-[60px]",
                  ratingAvg >= n
                    ? "fill-brand-gold text-brand-gold"
                    : "text-white/20",
                )}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-[60px] font-black text-white">
            {ratingAvg.toFixed(1)}
          </p>
          <p className="text-center text-[24px] text-white/60">⭐ 分</p>
          <p className="mt-2 text-center text-[14px] text-white/50">
            已有 {totalVotes} 人评分
          </p>
        </div>
      )}

      {currentMode === "lottery_waiting" && (
        <div className="flex h-full flex-col items-center justify-center">
          <Gift className="size-20 animate-float text-brand-gold" />
          <h2 className="mt-4 text-center text-[36px] font-black text-white">
            {lotteryTitle}
          </h2>
          <p className="mt-2 text-[18px] text-white/60">
            扫码参与 · 还剩 {Math.max(lotteryQuota - lotteryEntryCount, 0)} 个名额
          </p>
          <div className="mt-4 flex size-[160px] items-center justify-center rounded-xl bg-white p-2">
            {lotteryQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lotteryQrUrl} alt="抽奖二维码" className="size-full" />
            ) : (
              <span className="text-xs text-text-muted">二维码</span>
            )}
          </div>
          <p className="mt-2 text-sm text-white/40">用手机扫描参与</p>
          <AnimatedCount value={lotteryEntryCount} />
          <p className="text-[24px] text-white/50">人已参与</p>
        </div>
      )}

      {currentMode === "lottery_drawing" && (
        <div className="relative flex h-full flex-col">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, rgba(220,38,38,0.15) 0%, transparent 70%)",
            }}
          />
          <p className="relative mt-8 text-center text-[24px] font-bold text-white">
            {activePrize
              ? prizeRankLabel(activePrize.rank)
              : "正在抽取"}
            {activePrize?.prize ? ` · ${activePrize.prize}` : ""}
          </p>
          <div
            className={cn(
              "relative mx-auto mt-6 flex size-80 items-center justify-center overflow-hidden rounded-full border-4 bg-white/5",
              isRollingSettled
                ? "border-8 border-brand-gold"
                : "border-brand-gold",
            )}
          >
            {isRollingSettled && <SparkleParticles />}
            <div className="relative z-10 flex flex-col items-center">
              <Avatar
                className={cn(
                  "size-16 border-2 border-white/20 transition-transform duration-500",
                  isRollingSettled && "scale-110",
                )}
              >
                <AvatarFallback className="text-lg">
                  {displayPerson?.name?.slice(0, 1) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <p
                className={cn(
                  "mt-2 font-black text-white transition-all duration-500",
                  isRollingSettled ? "text-[40px]" : "text-[32px]",
                )}
              >
                {displayPerson?.name ?? "…"}
              </p>
              {isRollingSettled && displayPerson?.company && (
                <p className="mt-1 text-[18px] text-white/70">
                  {displayPerson.company}
                </p>
              )}
            </div>
          </div>
          {isRollingSettled && (
            <p className="relative mt-4 text-center text-[28px] font-bold text-brand-gold">
              🎉 恭喜获奖！
            </p>
          )}
        </div>
      )}

      {currentMode === "lottery_result" && (
        <div
          className="relative flex h-full flex-col overflow-y-auto pb-10"
          style={{
            background:
              "linear-gradient(to bottom, rgba(239,159,39,0.12) 0%, transparent 40%)",
          }}
        >
          <h2 className="pt-8 text-center text-[28px] font-bold text-white">
            🏆 本次抽奖获奖名单
          </h2>
          <div className="mt-8 grid grid-cols-3 gap-6 px-12">
            {allWinners.map((w, index) => (
              <div
                key={w.id}
                className="rounded-2xl bg-white/10 p-6 text-center"
                style={{
                  animationDelay: `${index * 0.3}s`,
                }}
              >
                <span
                  className={cn(
                    "inline-block rounded px-2 py-0.5 text-xs font-bold text-white",
                    w.prizeRank === 1 && "bg-red-500",
                    w.prizeRank === 2 && "bg-orange-400",
                    w.prizeRank === 3 && "bg-brand-gold",
                    w.prizeRank >= 4 && prizeRankBadgeClass(w.prizeRank),
                  )}
                >
                  {prizeRankLabel(w.prizeRank)}
                </span>
                <Avatar className="mx-auto mt-3 size-14 border-2 border-brand-gold">
                  <AvatarFallback>{w.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <p className="mt-3 text-[18px] font-bold text-white">{w.name}</p>
                {w.company && (
                  <p className="mt-1 text-sm text-white/60">{w.company}</p>
                )}
                <p className="mt-2 text-sm text-brand-gold">{w.prizeName}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
