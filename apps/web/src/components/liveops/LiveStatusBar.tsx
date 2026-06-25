"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { LiveOpsStatusBar } from "@/lib/live-ops-types";
import { cn } from "@/lib/utils";

type LiveStatusBarProps = {
  eventName: string;
  isLive: boolean;
  statusBar: LiveOpsStatusBar;
};

function AnimatedNum({ value }: { value: number }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span
      className={cn(
        "tabular-nums transition-transform duration-300",
        pulse && "scale-110",
      )}
    >
      {value}
    </span>
  );
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-xs text-brand-green">
        <ArrowUp className="size-3" />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center text-xs text-red-400">
        <ArrowDown className="size-3" />
        {Math.abs(delta)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs text-white/40">
      <Minus className="size-3" />
    </span>
  );
}

function Metric({
  label,
  value,
  trend,
}: {
  label: string;
  value: number;
  trend: number;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        <AnimatedNum value={value} />
      </p>
      <TrendArrow delta={trend} />
    </div>
  );
}

export function LiveStatusBar({
  eventName,
  isLive,
  statusBar,
}: LiveStatusBarProps) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    function tick() {
      setClock(
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-brand-blue/30 bg-brand-blue px-6 py-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-white">{eventName}</h1>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/20 px-3 py-1 text-xs font-semibold text-brand-green">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-green opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-brand-green" />
              </span>
              LIVE 进行中
            </span>
          )}
          <span className="font-mono text-sm text-white/70">{clock}</span>
        </div>

        <div className="grid grid-cols-4 gap-6 sm:gap-10">
          <Metric
            label="已签到"
            value={statusBar.checked_in}
            trend={statusBar.trends.checked_in}
          />
          <Metric
            label="在场人数"
            value={statusBar.on_site}
            trend={statusBar.trends.on_site}
          />
          <Metric
            label="已建立连接"
            value={statusBar.connections}
            trend={statusBar.trends.connections}
          />
          <Metric
            label="进行中互动"
            value={statusBar.live_interactions}
            trend={statusBar.trends.live_interactions}
          />
        </div>
      </div>
    </header>
  );
}
