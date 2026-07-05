"use client";

import { useMemo, type CSSProperties } from "react";
import type { PrecisionRollerProps } from "@/components/screen/lottery-animations/types";
import { WinnerResultCard } from "@/components/screen/lottery-animations/WinnerResultCard";
import styles from "@/components/screen/lottery-animations/PrecisionRoller.module.css";

const CHAR_HEIGHT_REM = 3.5;
const REPEAT = 5;
const MIN_ROLLERS = 4;
const MAX_ROLLERS = 6;
const FILLER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function splitChars(text: string) {
  return [...text.trim()];
}

function stopOffset(charIndex: number, charsetLength: number) {
  const len = Math.max(charsetLength, 1);
  const normalized = ((charIndex % len) + len) % len;
  const centerBias = 2;
  return -(normalized + centerBias * len) * CHAR_HEIGHT_REM;
}

function buildTrackChars(charset: string[]) {
  if (charset.length === 0) return ["—"];
  return Array.from({ length: REPEAT }, () => charset).flat();
}

function RollerColumn({
  rollerIndex,
  charset,
  finalIndex,
  phase,
  isStopped,
  justStopped,
}: {
  rollerIndex: number;
  charset: string[];
  finalIndex: number;
  phase: PrecisionRollerProps["phase"];
  isStopped: boolean;
  justStopped: boolean;
}) {
  const trackChars = buildTrackChars(charset);
  const stopYRem = stopOffset(finalIndex, charset.length);

  const trackClass = [
    styles.track,
    (phase === "spinning" || (phase === "stopping" && !isStopped))
      ? styles.trackSpinning
      : "",
    phase === "stopping" && isStopped && !justStopped ? styles.trackStopping : "",
    justStopped ? styles.trackSnap : "",
    phase === "revealed" ? styles.trackStopping : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stopStyle =
    isStopped || phase === "revealed" || justStopped
      ? ({ "--stop-y": `${stopYRem}rem` } as CSSProperties)
      : undefined;

  return (
    <div className={styles.roller} data-roller={rollerIndex}>
      <div className={styles.highlightBand} />
      <div
        className={trackClass}
        style={
          justStopped
            ? stopStyle
            : isStopped || phase === "revealed"
              ? { transform: `translateY(${stopYRem}rem)`, ...stopStyle }
              : stopStyle
        }
      >
        {trackChars.map((ch, i) => (
          <div key={`${ch}-${i}`} className={styles.charCell}>
            {ch}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PrecisionRoller({
  phase,
  charsets,
  finalIndices,
  stopSequence,
  stoppedRollers = [],
  winner,
  tierLabel,
  targetName,
}: PrecisionRollerProps) {
  const stoppedSet = useMemo(() => new Set(stoppedRollers), [stoppedRollers]);
  const lastStopped =
    stoppedRollers.length > 0
      ? stoppedRollers[stoppedRollers.length - 1]
      : undefined;

  const displayName = targetName.trim() || winner?.name?.trim() || "";

  const panelClass = [
    styles.panel,
    phase === "revealed" ? styles.panelRevealed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.root}>
      {tierLabel ? <p className={styles.tierHeading}>{tierLabel}</p> : null}

      <div className={styles.revealWrap}>
        <div className={panelClass}>
          {charsets.map((charset, rollerIndex) => {
            const isStopped =
              phase === "stopping"
                ? stoppedSet.has(rollerIndex)
                : phase === "revealed";
            const justStopped = rollerIndex === lastStopped;

            return (
              <RollerColumn
                key={rollerIndex}
                rollerIndex={rollerIndex}
                charset={charset}
                finalIndex={finalIndices[rollerIndex] ?? 0}
                phase={phase}
                isStopped={isStopped}
                justStopped={justStopped}
              />
            );
          })}
        </div>

        {phase === "revealed" && displayName ? (
          <p className={styles.nameBanner}>{displayName}</p>
        ) : null}

        {phase === "revealed" && winner ? (
          <div className="mt-6">
            <WinnerResultCard winner={winner} tierLabel={tierLabel} />
          </div>
        ) : null}
      </div>

      <span className={styles.watermark}>精工数轮</span>
    </div>
  );
}

/** 滚轮数量：按姓名字数动态生成，限制 4–6 */
export function resolveRollerCount(name: string): number {
  const len = splitChars(name).length;
  if (len === 0) return MIN_ROLLERS;
  return Math.min(MAX_ROLLERS, Math.max(MIN_ROLLERS, len));
}

/** 逐字目标字符（不足补位，超出截断） */
export function resolveRollerTargetChars(name: string): string[] {
  const chars = splitChars(name);
  const count = resolveRollerCount(name);
  if (chars.length === 0) {
    return Array.from({ length: count }, () => "—");
  }
  const targets = chars.slice(0, count);
  while (targets.length < count) {
    targets.push(chars[chars.length - 1] ?? "·");
  }
  return targets;
}

/** 为每列构建字符集（含目标字，保证可停准） */
export function buildRollerCharsets(
  entryNames: string[],
  targetChars: string[],
): string[][] {
  const pool = new Set<string>();
  for (const name of entryNames) {
    for (const ch of splitChars(name)) pool.add(ch);
  }
  for (const ch of targetChars) pool.add(ch);
  for (const ch of FILLER_CHARS) pool.add(ch);

  const base = [...pool];
  if (base.length === 0) base.push("—");

  return targetChars.map((target) => {
    const set = new Set(base);
    set.add(target);
    const list = [...set];
    if (list.indexOf(target) > 0) {
      const idx = list.indexOf(target);
      list.splice(idx, 1);
      list.unshift(target);
    }
    return list;
  });
}

/** 每列最终字符索引（后端姓名逐字确定） */
export function resolveRollerFinalIndices(
  charsets: string[][],
  targetChars: string[],
): number[] {
  return targetChars.map((ch, i) => {
    const charset = charsets[i] ?? [ch];
    const idx = charset.indexOf(ch);
    return idx >= 0 ? idx : 0;
  });
}

export function buildRollerStopSequence(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** 一站式：从候选人姓名池 + 中奖者姓名推导滚轮配置 */
export function buildPrecisionRollerConfig(
  entryNames: string[],
  winnerName: string,
) {
  const targetChars = resolveRollerTargetChars(winnerName);
  const charsets = buildRollerCharsets(entryNames, targetChars);
  const finalIndices = resolveRollerFinalIndices(charsets, targetChars);
  const stopSequence = buildRollerStopSequence(targetChars.length);
  return { targetChars, charsets, finalIndices, stopSequence };
}
