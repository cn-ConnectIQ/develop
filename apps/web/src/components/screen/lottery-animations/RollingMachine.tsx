"use client";

import { SlotMachineAnimation } from "@/components/lottery/SlotMachineAnimation";
import type { LotteryAnimationProps } from "@/components/screen/lottery-animations/types";

const BALL_COLORS = [
  { color: "#534AB7", bg: "#D4D0FF" },
  { color: "#B77A12", bg: "#FFE4B5" },
  { color: "#2E7D32", bg: "#C8E6C9" },
];

function toSlotPhase(phase: LotteryAnimationProps["phase"]) {
  if (phase === "spinning") return "animating" as const;
  if (phase === "stopping") return "pop" as const;
  return "revealed" as const;
}

export function RollingMachine({
  phase,
  winner,
  rollingEntries,
  tierLabel,
  entryCount,
}: LotteryAnimationProps) {
  const slotPhase = toSlotPhase(phase);
  const balls = rollingEntries.slice(0, 3).map((e, i) => ({
    initial: e.name.slice(0, 1) || "?",
    color: BALL_COLORS[i]?.color ?? BALL_COLORS[0]!.color,
    bg: BALL_COLORS[i]?.bg ?? BALL_COLORS[0]!.bg,
  }));

  const outletBall = winner
    ? {
        initial: winner.name.slice(0, 1) || "?",
        color: "#534AB7",
        bg: "#D4D0FF",
      }
    : rollingEntries[0]
      ? {
          initial: rollingEntries[0].name.slice(0, 1) || "?",
          color: "#534AB7",
          bg: "#D4D0FF",
        }
      : undefined;

  if (phase === "revealed" && winner) {
    return (
      <SlotMachineAnimation
        phase="revealed"
        tierLabel={tierLabel}
        winner={{
          name: winner.name,
          company: winner.company,
          prize_name: winner.prize_name,
        }}
        outletBall={outletBall}
      />
    );
  }

  return (
    <SlotMachineAnimation
      phase={slotPhase}
      tierLabel={tierLabel}
      entryCount={entryCount}
      balls={balls.length > 0 ? balls : undefined}
      outletBall={outletBall}
    />
  );
}
