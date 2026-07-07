"use client";

import { tierMedal } from "@/lib/lottery/organizer-lottery-config";
import type { LotteryTierState } from "@/lib/lottery/lottery-screen-service";

type TierWinnersListProps = {
  tier: LotteryTierState;
  winners: Array<{
    id: string;
    name: string;
    company: string | null;
    prize_rank: number;
  }>;
};

export function TierWinnersList({ tier, winners }: TierWinnersListProps) {
  const tierWinners = winners.filter((w) => w.prize_rank === tier.tier);
  if (tierWinners.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[#1A2035] p-5">
      <p className="mb-3 text-sm font-semibold text-white/50">
        {tierMedal(tier.tier)} {tier.label} 已抽出 {tierWinners.length}/{tier.quantity} 位
      </p>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {tierWinners.map((w, index) => (
          <div
            key={w.id}
            className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-xs font-bold text-brand-gold">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{w.name}</p>
              <p className="truncate text-xs text-white/40">{w.company ?? "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
