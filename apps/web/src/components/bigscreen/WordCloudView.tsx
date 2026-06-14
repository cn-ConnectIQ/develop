"use client";

import { useMemo } from "react";
import type { WordCloudItem } from "@/lib/bigscreen-types";

type WordCloudViewProps = {
  words: WordCloudItem[];
};

type PlacedWord = WordCloudItem & {
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
};

export function WordCloudView({ words }: WordCloudViewProps) {
  const placed = useMemo(() => layoutWords(words), [words]);

  if (words.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/40">
        等待观众提交关键词…
      </div>
    );
  }

  const maxCount = Math.max(...words.map((w) => w.count), 1);

  return (
    <div className="flex flex-1 items-center justify-center px-8 pb-24">
      <svg viewBox="0 0 800 400" className="h-full max-h-[420px] w-full">
        {placed.map((word) => (
          <text
            key={`${word.text}-${word.x}-${word.y}`}
            x={word.x}
            y={word.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fillOpacity={word.opacity}
            fontSize={word.fontSize}
            fontWeight={word.count >= maxCount * 0.6 ? 700 : 400}
            className="select-none transition-all duration-500"
          >
            {word.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

function layoutWords(words: WordCloudItem[]): PlacedWord[] {
  if (words.length === 0) return [];

  const maxCount = Math.max(...words.map((w) => w.count), 1);
  const minCount = Math.min(...words.map((w) => w.count), maxCount);
  const cx = 400;
  const cy = 200;

  return words.slice(0, 40).map((word, index) => {
    const ratio =
      maxCount === minCount
        ? 0.7
        : (word.count - minCount) / (maxCount - minCount);
    const fontSize = 14 + ratio * 42;
    const angle = index * 2.4;
    const radius = 20 + index * 9 + (1 - ratio) * 30;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.65;
    const opacity = 0.35 + ratio * 0.65;

    return { ...word, x, y, fontSize, opacity };
  });
}
