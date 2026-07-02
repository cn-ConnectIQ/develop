"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gift, Sparkles, Trophy } from "lucide-react";
import { SCREEN_ANIMATION_OPTIONS } from "@/lib/lottery/organizer-lottery-config";
import type { ScreenAnimationType } from "@/lib/lottery/organizer-lottery-config";
import {
  subscribeLotteryScreen,
  type LotteryScreenBroadcast,
  type LotteryScreenRollingEntry,
  type LotteryScreenWinnerPayload,
} from "@/lib/realtime/lottery-screen";
import { cn } from "@/lib/utils";

type DisplayPhase = "idle" | "animating" | "revealed" | "ended";

function animationLabel(type: ScreenAnimationType) {
  return SCREEN_ANIMATION_OPTIONS.find((o) => o.value === type)?.title ?? type;
}

function RollingSlot({
  entries,
  active,
}: {
  entries: LotteryScreenRollingEntry[];
  active: boolean;
}) {
  const [current, setCurrent] = useState(entries[0] ?? null);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || entries.length === 0) {
      if (ref.current) clearInterval(ref.current);
      return;
    }

    let delay = 60;
    let step = 0;

    function tick() {
      const pick = entries[Math.floor(Math.random() * entries.length)]!;
      setCurrent(pick);
      step += 1;
      if (step > 30 && step % 2 === 0) delay = Math.min(delay + 30, 400);
      if (ref.current) clearInterval(ref.current);
      ref.current = setInterval(tick, delay);
    }

    ref.current = setInterval(tick, delay);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [active, entries]);

  if (!current) return null;

  return (
    <div className="text-center">
      <p className="text-5xl font-black tracking-tight text-white md:text-7xl">
        {current.name}
      </p>
      {current.company && (
        <p className="mt-3 text-xl text-white/60">{current.company}</p>
      )}
    </div>
  );
}

function WheelAnimation({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "relative mx-auto size-64 rounded-full border-8 border-brand-gold/40 md:size-80",
        active && "animate-spin",
      )}
      style={{ animationDuration: active ? "3s" : "0s" }}
    >
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-brand-purple/40 to-brand-blue/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-5xl">🎡</span>
      </div>
    </div>
  );
}

function RedEnvelopeRain({ active }: { active: boolean }) {
  const drops = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((_, i) => (
        <span
          key={i}
          className={cn(
            "absolute text-3xl",
            active && "animate-bounce",
          )}
          style={{
            left: `${(i * 13) % 100}%`,
            top: `${(i * 7) % 80}%`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: "1.2s",
          }}
        >
          🧧
        </span>
      ))}
    </div>
  );
}

function WinnerReveal({
  winner,
  title,
}: {
  winner: LotteryScreenWinnerPayload;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-brand-gold/20 ring-4 ring-brand-gold/50">
        <Trophy className="size-12 text-brand-gold" />
      </div>
      <p className="text-sm uppercase tracking-[0.3em] text-brand-gold">
        {winner.prize_name}
      </p>
      <h1 className="mt-4 text-5xl font-black text-white md:text-7xl">
        {winner.name}
      </h1>
      {winner.company && (
        <p className="mt-3 text-2xl text-white/70">{winner.company}</p>
      )}
      {winner.verification_code && (
        <p className="mt-8 font-mono text-3xl tracking-widest text-brand-amber">
          {winner.verification_code}
        </p>
      )}
      <p className="mt-4 text-lg text-white/50">{winner.pickup_note}</p>
      <p className="mt-8 text-sm text-white/30">{title}</p>
    </div>
  );
}

export type LotteryScreenDisplayClientProps = {
  eventId: string;
  eventName: string;
};

export function LotteryScreenDisplayClient({
  eventId,
  eventName,
}: LotteryScreenDisplayClientProps) {
  const searchParams = useSearchParams();
  const filterLotteryId = searchParams.get("lottery");

  const [phase, setPhase] = useState<DisplayPhase>("idle");
  const [title, setTitle] = useState("闭幕全场大抽奖");
  const [animation, setAnimation] =
    useState<ScreenAnimationType>("SLOT_MACHINE");
  const [entryCount, setEntryCount] = useState(0);
  const [rollingEntries, setRollingEntries] = useState<
    LotteryScreenRollingEntry[]
  >([]);
  const [currentWinner, setCurrentWinner] =
    useState<LotteryScreenWinnerPayload | null>(null);
  const [winners, setWinners] = useState<LotteryScreenWinnerPayload[]>([]);
  const [progress, setProgress] = useState({ revealed: 0, quota: 0 });

  useEffect(() => {
    const unsub = subscribeLotteryScreen(eventId, (msg: LotteryScreenBroadcast) => {
      if (
        filterLotteryId &&
        "lottery_id" in msg.data &&
        msg.data.lottery_id !== filterLotteryId
      ) {
        return;
      }

      if (msg.type === "START_ANIMATION") {
        setTitle(msg.data.title);
        setAnimation(msg.data.animation);
        setEntryCount(msg.data.entry_count);
        setRollingEntries(msg.data.rolling_entries);
        setCurrentWinner(null);
        setPhase("animating");
      }

      if (msg.type === "REVEAL_WINNER") {
        setCurrentWinner(msg.data.winner);
        setWinners((prev) => [...prev, msg.data.winner]);
        setProgress({
          revealed: msg.data.revealed_total,
          quota: msg.data.winner_quota,
        });
        setPhase("revealed");
      }

      if (msg.type === "END") {
        setPhase("ended");
      }
    });

    return () => {
      unsub?.();
    };
  }, [eventId, filterLotteryId]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a12] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1a3e_0%,_#0a0a12_60%)]" />

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div>
          <p className="text-sm text-white/40">{eventName}</p>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/40">参与人数</p>
          <p className="text-3xl font-black text-brand-gold">{entryCount}</p>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 pb-16">
        {phase === "idle" && (
          <div className="text-center">
            <Gift className="mx-auto size-20 text-brand-gold/40" />
            <p className="mt-6 text-2xl text-white/50">等待控制台启动抽奖…</p>
            <p className="mt-2 text-sm text-white/30">
              频道 event:{eventId.slice(-6)}:lottery-screen
            </p>
          </div>
        )}

        {phase === "animating" && (
          <div className="relative w-full max-w-4xl">
            {animation === "RED_ENVELOPE" && <RedEnvelopeRain active />}
            <p className="mb-8 text-center text-sm uppercase tracking-widest text-brand-gold">
              {animationLabel(animation)}
            </p>
            {animation === "WHEEL" ? (
              <WheelAnimation active />
            ) : (
              <RollingSlot entries={rollingEntries} active />
            )}
            <div className="mt-10 flex justify-center gap-2">
              <Sparkles className="size-5 animate-pulse text-brand-gold" />
              <span className="text-white/50">抽奖进行中…</span>
            </div>
          </div>
        )}

        {phase === "revealed" && currentWinner && (
          <WinnerReveal winner={currentWinner} title={title} />
        )}

        {phase === "ended" && (
          <div className="text-center">
            <Trophy className="mx-auto size-24 text-brand-gold" />
            <h2 className="mt-6 text-4xl font-bold">抽奖圆满落幕</h2>
            <p className="mt-2 text-white/50">共揭晓 {winners.length} 位中奖者</p>
          </div>
        )}
      </main>

      {winners.length > 0 && phase !== "idle" && (
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
