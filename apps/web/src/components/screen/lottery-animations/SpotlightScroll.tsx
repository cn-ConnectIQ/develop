"use client";

import { useMemo } from "react";
import type { LotteryAnimationProps } from "@/components/screen/lottery-animations/types";
import { WinnerResultCard } from "@/components/screen/lottery-animations/WinnerResultCard";
import styles from "@/components/screen/lottery-animations/SpotlightScroll.module.css";

function formatRow(name: string, company?: string | null) {
  return company ? `${name} · ${company}` : name;
}

function findHighlightEntry(
  winner: LotteryAnimationProps["winner"],
  entries: LotteryAnimationProps["rollingEntries"],
) {
  if (!winner) return null;
  return (
    entries.find((e) => e.name === winner.name) ?? {
      id: winner.name,
      name: winner.name,
      company: winner.company ?? null,
    }
  );
}

export function SpotlightScroll({
  phase,
  winner,
  rollingEntries,
  tierLabel,
}: LotteryAnimationProps) {
  const highlight = useMemo(
    () =>
      phase === "stopping" || phase === "revealed"
        ? findHighlightEntry(winner, rollingEntries)
        : null,
    [phase, winner, rollingEntries],
  );

  const rows = useMemo(() => {
    if (rollingEntries.length === 0) {
      return ["等待名单同步…", "等待名单同步…"];
    }
    return [...rollingEntries, ...rollingEntries].map((e) =>
      formatRow(e.name, e.company),
    );
  }, [rollingEntries]);

  const trackClass = [
    styles.scrollTrack,
    phase === "spinning" ? styles.scrollTrackActive : "",
    phase === "stopping" ? styles.scrollTrackStopping : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (phase === "revealed" && winner) {
    return (
      <div className={styles.revealWrap}>
        <WinnerResultCard winner={winner} tierLabel={tierLabel} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {tierLabel ? <p className={styles.tierLabel}>{tierLabel}</p> : null}
      <div className={styles.scrollViewport}>
        <div className={trackClass}>
          {rows.map((row, i) => {
            const isHighlight =
              highlight &&
              (row.startsWith(highlight.name) || row.includes(highlight.name));
            return (
              <span
                key={`${row}-${i}`}
                className={[styles.row, isHighlight ? styles.rowHighlight : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {row}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
