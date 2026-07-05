"use client";

import { Ma_Shan_Zheng } from "next/font/google";
import type { CSSProperties } from "react";
import type { ScrollUnveilingProps } from "@/components/screen/lottery-animations/types";
import { WinnerResultCard } from "@/components/screen/lottery-animations/WinnerResultCard";
import styles from "@/components/screen/lottery-animations/ScrollUnveiling.module.css";

/** Google Fonts OFL 1.1，可免费商用；回退系统楷体 */
const scrollCalligraphy = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-scroll-calligraphy",
});

const CHAR_STAGGER_MS = 120;
const UNROLL_BASE_MS = 800;

function splitChars(text: string) {
  return [...text];
}

function InkWashBackground() {
  return (
    <>
      <div className={styles.inkWash} aria-hidden />
      <div
        className={styles.inkBlob}
        aria-hidden
        style={{ width: "45%", height: "40%", top: "8%", left: "-8%" }}
      />
      <div
        className={styles.inkBlob}
        aria-hidden
        style={{ width: "38%", height: "35%", bottom: "5%", right: "-6%" }}
      />
    </>
  );
}

function ScrollSvg() {
  return (
    <svg
      className={styles.scrollSvg}
      viewBox="0 0 520 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="36" cy="80" rx="22" ry="52" fill="#3d3428" />
      <ellipse cx="36" cy="80" rx="16" ry="46" fill="#5c4f3a" />
      <rect x="48" y="28" width="12" height="104" rx="4" fill="#4a4032" />
      <ellipse cx="484" cy="80" rx="22" ry="52" fill="#3d3428" />
      <ellipse cx="484" cy="80" rx="16" ry="46" fill="#5c4f3a" />
      <rect x="460" y="28" width="12" height="104" rx="4" fill="#4a4032" />
      <rect x="58" y="32" width="404" height="96" rx="6" fill="url(#parchmentGrad)" />
      <rect
        x="58"
        y="32"
        width="404"
        height="96"
        rx="6"
        stroke="#b8a078"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <ellipse cx="58" cy="80" rx="14" ry="48" fill="#c4b08a" opacity="0.5" />
      <ellipse cx="462" cy="80" rx="14" ry="48" fill="#c4b08a" opacity="0.5" />
      <defs>
        <linearGradient id="parchmentGrad" x1="58" y1="32" x2="462" y2="128">
          <stop offset="0%" stopColor="#ebe0cc" />
          <stop offset="45%" stopColor="#f3e8d4" />
          <stop offset="100%" stopColor="#e8d9bc" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SealStamp({ visible }: { visible: boolean }) {
  return (
    <div
      className={[styles.seal, visible ? styles.sealStamp : ""]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <svg
        className={styles.sealSvg}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="4"
          fill="none"
          stroke="#991b1b"
          strokeWidth="3"
        />
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontSize="28"
          fill="#991b1b"
          fontFamily="var(--font-scroll-calligraphy, 'KaiTi', serif)"
        >
          奖
        </text>
      </svg>
    </div>
  );
}

function StaggeredLine({
  text,
  phase,
  className,
  baseDelayMs = UNROLL_BASE_MS,
}: {
  text: string;
  phase: ScrollUnveilingProps["phase"];
  className: string;
  baseDelayMs?: number;
}) {
  const chars = splitChars(text);

  return (
    <p className={className}>
      {chars.map((ch, i) => {
        const charClass = [
          styles.char,
          phase === "revealed" ? styles.charRevealed : "",
          phase === "stopping" ? styles.charReveal : "",
          phase === "spinning" ? styles.charHidden : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span
            key={`${ch}-${i}`}
            className={charClass}
            style={
              phase === "stopping"
                ? { animationDelay: `${baseDelayMs + i * CHAR_STAGGER_MS}ms` }
                : undefined
            }
          >
            {ch}
          </span>
        );
      })}
    </p>
  );
}

export function ScrollUnveiling({
  phase,
  heading,
  revealName,
  revealCompany,
  winner,
  tierLabel,
}: ScrollUnveilingProps) {
  const displayHeading = tierLabel ?? heading;
  const nameChars = splitChars(revealName.trim());
  const companyDelayBase =
    UNROLL_BASE_MS + nameChars.length * CHAR_STAGGER_MS + 200;

  const paperClipClass = [
    styles.paperClip,
    phase === "spinning" ? styles.paperClipRolled : "",
    phase === "stopping" ? styles.paperClipUnrolling : "",
    phase === "revealed" ? styles.paperClipOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  const scrollWrapClass = [
    styles.scrollWrap,
    phase === "spinning" ? styles.scrollWrapSway : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stageClass = [
    styles.stage,
    phase === "revealed" ? styles.stageRevealed : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showText = phase !== "spinning" && revealName.trim().length > 0;

  return (
    <div
      className={`${styles.root} ${scrollCalligraphy.variable}`}
      style={
        {
          fontFamily:
            "var(--font-scroll-calligraphy), 'STKaiti', 'KaiTi', '楷体', serif",
        } as CSSProperties
      }
    >
      <InkWashBackground />

      {phase === "spinning" && displayHeading ? (
        <h2 className={`${styles.heading} ${scrollCalligraphy.className}`}>
          {displayHeading}
        </h2>
      ) : null}

      <div className={stageClass}>
        <div className={scrollWrapClass}>
          <div className={styles.scrollAssembly}>
            <div className={paperClipClass}>
              <ScrollSvg />
              {showText ? (
                <div className={styles.content}>
                  <StaggeredLine
                    text={revealName}
                    phase={phase}
                    className={`${styles.nameLine} ${scrollCalligraphy.className}`}
                  />
                  {revealCompany ? (
                    <StaggeredLine
                      text={revealCompany}
                      phase={phase}
                      className={styles.companyLine}
                      baseDelayMs={companyDelayBase}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <SealStamp visible={phase === "revealed"} />
          </div>
        </div>

        {phase === "revealed" && winner ? (
          <div className={styles.cardAside}>
            <WinnerResultCard winner={winner} tierLabel={tierLabel} />
          </div>
        ) : null}
      </div>

      <span className={styles.watermark}>卷轴揭榜</span>
    </div>
  );
}

/** 估算 stopping → revealed 所需时长（毫秒） */
export function calcScrollUnveilingDuration(
  name: string,
  company?: string | null,
): number {
  const nameLen = splitChars(name.trim()).length;
  const companyLen = company ? splitChars(company.trim()).length : 0;
  return (
    UNROLL_BASE_MS +
    nameLen * CHAR_STAGGER_MS +
    companyLen * CHAR_STAGGER_MS +
    1200
  );
}
