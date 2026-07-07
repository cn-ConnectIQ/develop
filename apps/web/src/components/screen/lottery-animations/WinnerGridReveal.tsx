"use client";

import { tierMedal } from "@/lib/lottery/organizer-lottery-config";
import type { ReelWinnerInfo } from "@/components/screen/lottery-animations/types";
import styles from "@/components/screen/lottery-animations/WinnerGridReveal.module.css";

type WinnerGridRevealProps = {
  winners: ReelWinnerInfo[];
  tierLabel?: string | null;
  prizeName?: string;
};

function avatarInitial(name: string) {
  return name.trim().slice(0, 1) || "?";
}

export function WinnerGridReveal({
  winners,
  tierLabel,
  prizeName,
}: WinnerGridRevealProps) {
  const rank = winners[0]?.prize_rank ?? 1;
  const label = tierLabel ?? `${tierMedal(rank)} ${rank}等奖`;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className={styles.tier}>{label}揭晓</p>
        <h2 className={styles.title}>
          本次 {winners.length} 位获奖者
          {prizeName ? ` · ${prizeName}` : ""}
        </h2>
      </header>
      <div className={styles.grid}>
        {winners.map((w) => (
          <article key={`${w.name}-${w.prize_rank}`} className={styles.cell}>
            <span className={styles.avatar}>{avatarInitial(w.name)}</span>
            <p className={styles.name}>{w.name}</p>
            {w.company ? <p className={styles.company}>{w.company}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
