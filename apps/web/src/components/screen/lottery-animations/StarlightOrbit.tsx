"use client";

import { useMemo, type CSSProperties } from "react";
import type { StarlightOrbitProps } from "@/components/screen/lottery-animations/types";
import { WinnerResultCard } from "@/components/screen/lottery-animations/WinnerResultCard";
import styles from "@/components/screen/lottery-animations/StarlightOrbit.module.css";

const MAX_ORBIT_AVATARS = 16;
const ORBIT_EXTRA_SPINS = 4;

function avatarInitial(name: string) {
  return name.trim().slice(0, 1) || "?";
}

function prepareOrbitDisplay(
  entries: StarlightOrbitProps["entries"],
  winnerIndex: number,
) {
  if (entries.length === 0) {
    return {
      displayEntries: [{ id: "_", name: "—", company: null }],
      displayWinnerIndex: 0,
    };
  }
  if (entries.length <= MAX_ORBIT_AVATARS) {
    return { displayEntries: entries, displayWinnerIndex: winnerIndex };
  }
  const safeWinner = Math.min(Math.max(winnerIndex, 0), entries.length - 1);
  const winner = entries[safeWinner]!;
  const others = entries
    .filter((_, i) => i !== safeWinner)
    .slice(0, MAX_ORBIT_AVATARS - 1);
  const displayEntries = [...others, winner];
  return { displayEntries, displayWinnerIndex: displayEntries.length - 1 };
}

function buildStars(count = 48) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * 23 + 7) % 100}%`,
    top: `${(i * 31 + 11) % 100}%`,
    size: `${0.08 + (i % 4) * 0.06}rem`,
    opacity: 0.15 + (i % 5) * 0.08,
    delay: `${(i % 9) * 0.35}s`,
  }));
}

function GatherParticles({ targetY }: { targetY: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const dist = 35 + (i % 4) * 12;
        return {
          id: i,
          left: `${50 + Math.cos(angle) * dist}%`,
          top: `${20 + Math.sin(angle) * dist * 0.6}%`,
          delay: `${(i % 6) * 0.12}s`,
          gatherX: `${(50 - (50 + Math.cos(angle) * dist)) * -0.02}rem`,
          gatherY: targetY,
        };
      }),
    [targetY],
  );

  return (
    <div className={styles.gatherLayer} aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className={styles.gatherParticle}
          style={{
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            "--gather-x": p.gatherX,
            "--gather-y": p.gatherY,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Starfield() {
  const stars = useMemo(() => buildStars(), []);

  return (
    <div className={styles.starfield} aria-hidden>
      {stars.map((s) => (
        <span
          key={s.id}
          className={styles.star}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            "--star-opacity": String(s.opacity),
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function OrbitAvatars({
  displayEntries,
  displayWinnerIndex,
  phase,
}: {
  displayEntries: StarlightOrbitProps["entries"];
  displayWinnerIndex: number;
  phase: StarlightOrbitProps["phase"];
}) {
  const count = displayEntries.length;

  return (
    <>
      {displayEntries.map((entry, i) => {
        const angle = (360 / count) * i;
        const isWinner = i === displayWinnerIndex;
        const avatarClass = [
          styles.avatar,
          phase === "stopping" && !isWinner ? styles.avatarDim : "",
          phase === "stopping" && isWinner ? styles.avatarHighlight : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={entry.id}
            className={styles.avatarSlot}
            style={{
              transform: `rotate(${angle}deg) translateY(calc(-1 * var(--orbit-radius))) rotate(${-angle}deg)`,
            }}
          >
            <span className={avatarClass} title={entry.name}>
              {avatarInitial(entry.name)}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function StarlightOrbit({
  phase,
  entries,
  winnerIndex,
  winner,
  tierLabel,
}: StarlightOrbitProps) {
  const { displayEntries, displayWinnerIndex } = useMemo(
    () => prepareOrbitDisplay(entries, winnerIndex),
    [entries, winnerIndex],
  );

  const stopAngleDeg = useMemo(
    () => resolveOrbitStopAngle(displayWinnerIndex, displayEntries.length),
    [displayWinnerIndex, displayEntries.length],
  );

  const ringStyle = useMemo(
    () =>
      phase === "stopping" || phase === "revealed"
        ? ({ "--stop-angle": `${stopAngleDeg}deg` } as CSSProperties)
        : undefined,
    [phase, stopAngleDeg],
  );
  const ringClass = [
    styles.orbitRing,
    phase === "spinning" ? styles.orbitRingSpinning : "",
    phase === "stopping" ? styles.orbitRingStopping : "",
    phase === "revealed" ? styles.orbitRingFrozen : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (phase === "revealed" && winner) {
    return (
      <div className={styles.root}>
        <Starfield />
        <div className={styles.revealWrap}>
          <GatherParticles targetY="4.5rem" />
          <div className={styles.heroAvatar}>{avatarInitial(winner.name)}</div>
          <WinnerResultCard winner={winner} tierLabel={tierLabel} />
        </div>
        <span className={styles.watermark}>星轨流转</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Starfield />
      {tierLabel ? <p className={styles.tierHeading}>{tierLabel}</p> : null}
      <div className={styles.orbitStage}>
        <div className={styles.orbitGuide} />
        <div className={styles.topMarker} aria-hidden />
        <div className={styles.orbitCore} />
        <div className={ringClass} style={ringStyle}>
          <OrbitAvatars
            displayEntries={displayEntries}
            displayWinnerIndex={displayWinnerIndex}
            phase={phase}
          />
        </div>
      </div>
      <span className={styles.watermark}>星轨流转</span>
    </div>
  );
}

/** 根据后端揭晓的中奖者 ID 计算轨道索引（非随机） */
export function resolveOrbitWinnerIndex(
  entries: Array<{ id: string }>,
  winnerUserId: string,
): number {
  const idx = entries.findIndex((e) => e.id === winnerUserId);
  return idx >= 0 ? idx : 0;
}

/** 计算减速定格时的最终旋转角，使 winnerIndex 停在 12 点方向 */
export function resolveOrbitStopAngle(
  winnerIndex: number,
  entryCount: number,
): number {
  const n = Math.max(entryCount, 1);
  const idx = ((winnerIndex % n) + n) % n;
  const slotAngle = (360 / n) * idx;
  const align = (360 - slotAngle) % 360;
  return ORBIT_EXTRA_SPINS * 360 + align;
}
