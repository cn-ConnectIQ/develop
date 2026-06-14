"use client";

import { countdownProgress } from "@/lib/bigscreen-display";

type CountdownRingProps = {
  closesAt: string | null;
  startedAt: string | null;
  size?: number;
};

export function CountdownRing({
  closesAt,
  startedAt,
  size = 40,
}: CountdownRingProps) {
  const progress = countdownProgress(closesAt, startedAt);
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-brand-amber, #F5A623)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000"
      />
    </svg>
  );
}
