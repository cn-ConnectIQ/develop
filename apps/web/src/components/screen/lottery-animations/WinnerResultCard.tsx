"use client";

import { Trophy } from "lucide-react";
import { tierLabel as tierLabelText } from "@/lib/lottery/organizer-lottery-config";
import type { ReelWinnerInfo } from "@/components/screen/lottery-animations/types";
import styles from "@/components/screen/lottery-animations/WinnerResultCard.module.css";

type WinnerResultCardProps = {
  winner: ReelWinnerInfo;
  tierLabel?: string | null;
};

function avatarInitial(name: string) {
  return name.trim().slice(0, 1) || "?";
}

export function WinnerResultCard({ winner, tierLabel }: WinnerResultCardProps) {
  const rankLabel = tierLabel ?? tierLabelText(winner.prize_rank);

  return (
    <article className={styles.card}>
      <div className={styles.avatarRing}>
        <span className={styles.avatar}>{avatarInitial(winner.name)}</span>
      </div>
      <p className={styles.tier}>
        <Trophy className={styles.tierIcon} aria-hidden />
        {rankLabel}
      </p>
      <h2 className={styles.name}>{winner.name}</h2>
      {winner.company ? (
        <p className={styles.company}>{winner.company}</p>
      ) : null}
      <p className={styles.prize}>{winner.prize_name}</p>
      {winner.verification_code ? (
        <p className={styles.code}>{winner.verification_code}</p>
      ) : null}
      {winner.pickup_note ? (
        <p className={styles.note}>{winner.pickup_note}</p>
      ) : null}
    </article>
  );
}
