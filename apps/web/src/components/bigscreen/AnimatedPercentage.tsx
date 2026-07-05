"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedPercentageProps = {
  value: number;
  className?: string;
};

/** PR5 · 条形赛跑百分比滚动动画 */
export function AnimatedPercentage({
  value,
  className,
}: AnimatedPercentageProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const duration = 700;
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{display}%</span>;
}
