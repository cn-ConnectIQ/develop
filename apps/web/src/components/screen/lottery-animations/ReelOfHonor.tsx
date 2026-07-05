"use client";

import { useMemo } from "react";
import type { ReelOfHonorProps } from "@/components/screen/lottery-animations/types";
import { WinnerResultCard } from "@/components/screen/lottery-animations/WinnerResultCard";
import styles from "@/components/screen/lottery-animations/ReelOfHonor.module.css";

const ITEM_HEIGHT_REM = 4.5;
const REPEAT = 4;

function avatarInitial(name: string) {
  return name.trim().slice(0, 1) || "?";
}

function buildTrackItems(entries: ReelOfHonorProps["columns"][number]) {
  if (entries.length === 0) {
    return [{ id: "placeholder", name: "等待名单…", company: null }];
  }
  const repeated = Array.from({ length: REPEAT }, () => entries).flat();
  return repeated;
}

function stopOffset(finalIndex: number, poolLength: number) {
  const len = Math.max(poolLength, 1);
  const normalized = ((finalIndex % len) + len) % len;
  const centerBias = 1;
  return -(normalized + centerBias * len) * ITEM_HEIGHT_REM;
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 5) % 100}%`,
        delay: `${(i % 7) * 0.18}s`,
        duration: `${2.2 + (i % 5) * 0.25}s`,
        hue: i % 3 === 0 ? "#ef9f27" : i % 3 === 1 ? "#fde68a" : "#fff",
      })),
    [],
  );

  return (
    <div className={styles.confettiLayer} aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: p.hue,
          }}
        />
      ))}
    </div>
  );
}

function ReelColumn({
  columnIndex,
  entries,
  finalIndex,
  phase,
  isStopped,
  justStopped,
}: {
  columnIndex: number;
  entries: ReelOfHonorProps["columns"][number];
  finalIndex: number;
  phase: ReelOfHonorProps["phase"];
  isStopped: boolean;
  justStopped: boolean;
}) {
  const poolLength = Math.max(entries.length, 1);
  const trackItems = buildTrackItems(entries);
  const offsetRem = stopOffset(finalIndex, poolLength);

  const trackClass = [
    styles.track,
    (phase === "spinning" || (phase === "stopping" && !isStopped))
      ? styles.trackSpinning
      : "",
    (phase === "stopping" && isStopped) || phase === "revealed"
      ? styles.trackStopping
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const columnClass = [
    styles.column,
    justStopped ? styles.columnFlash : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={columnClass} data-column={columnIndex}>
      <div className={styles.highlightBand} />
      <div
        className={trackClass}
        style={
          isStopped || phase === "revealed"
            ? { transform: `translateY(${offsetRem}rem)` }
            : undefined
        }
      >
        {trackItems.map((entry, i) => (
          <div key={`${entry.id}-${i}`} className={styles.item}>
            <span className={styles.avatar}>{avatarInitial(entry.name)}</span>
            <div className={styles.itemText}>
              <p className={styles.name}>{entry.name}</p>
              {entry.company ? (
                <p className={styles.company}>{entry.company}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReelOfHonor({
  phase,
  columns,
  finalIndices,
  stopSequence,
  stoppedColumns = [],
  winner,
  tierLabel,
}: ReelOfHonorProps) {
  const stoppedSet = useMemo(() => new Set(stoppedColumns), [stoppedColumns]);
  const lastStopped =
    stoppedColumns.length > 0
      ? stoppedColumns[stoppedColumns.length - 1]
      : undefined;

  if (phase === "revealed" && winner) {
    return (
      <div className={styles.root}>
        <div className={styles.revealWrap}>
          <Confetti />
          <WinnerResultCard winner={winner} tierLabel={tierLabel} />
        </div>
        <span className={styles.watermark}>荣耀转轮</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {tierLabel ? <p className={styles.tierHeading}>{tierLabel}</p> : null}
      <div className={styles.panel}>
        {columns.map((col, columnIndex) => {
          const isStopped =
            phase === "stopping"
              ? stoppedSet.has(columnIndex)
              : phase === "revealed";
          const justStopped = columnIndex === lastStopped;

          return (
            <ReelColumn
              key={columnIndex}
              columnIndex={columnIndex}
              entries={col}
              finalIndex={finalIndices[columnIndex] ?? 0}
              phase={phase}
              isStopped={isStopped}
              justStopped={justStopped}
            />
          );
        })}
      </div>
      <span className={styles.watermark}>荣耀转轮</span>
    </div>
  );
}

/** 从候选人池构建三列相同奖池（结果索引由后端/Realtime 决定） */
export function buildReelColumns(
  entries: Array<{ id: string; name: string; company?: string | null }>,
): ReelOfHonorProps["columns"] {
  const pool = entries.length > 0 ? entries : [{ id: "_", name: "—", company: null }];
  return [pool, pool, pool];
}

/** 根据后端揭晓的中奖者 ID 计算各列停止索引（非随机） */
export function resolveReelFinalIndices(
  entries: Array<{ id: string }>,
  winnerUserId: string,
): [number, number, number] {
  const idx = entries.findIndex((e) => e.id === winnerUserId);
  const safe = idx >= 0 ? idx : 0;
  return [safe, safe, safe];
}

export const DEFAULT_REEL_STOP_SEQUENCE: readonly number[] = [0, 1, 2];
