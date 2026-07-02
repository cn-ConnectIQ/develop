"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { BoothRankingItem } from "@/lib/booth-rankings-service";
import { useBigscreenStore } from "@/stores/bigscreenStore";

type RankingsResponse = {
  event_name: string;
  rankings: BoothRankingItem[];
};

type DisplayRow = BoothRankingItem & {
  rankDelta: number | null;
  isNew: boolean;
  pulse: boolean;
};

async function fetchRankings(eventId: string): Promise<RankingsResponse> {
  const res = await fetch(`/api/events/${eventId}/booth-rankings`);
  if (!res.ok) throw new Error("加载排行榜失败");
  return (await res.json()).data as RankingsResponse;
}

function ChangeBadge({ change }: { change: number }) {
  if (change <= 0) return null;
  return (
    <span className="animate-pulse text-sm font-medium text-brand-green">
      +{change} ↑
    </span>
  );
}

function RankDeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return null;
  if (delta > 0) {
    return (
      <span className="mr-2 text-sm font-medium text-brand-green">↑{delta}</span>
    );
  }
  return (
    <span className="mr-2 text-sm font-medium text-brand-red">↓{Math.abs(delta)}</span>
  );
}

function TopThreeCard({
  item,
  variant,
}: {
  item: DisplayRow;
  variant: 1 | 2 | 3;
}) {
  const medals = ["🥇", "🥈", "🥉"] as const;
  const rankColors = ["text-brand-gold", "text-gray-300", "text-[#CD7F32]"] as const;

  const heights = ["h-[100px]", "h-[88px]", "h-[80px]"] as const;
  const borders = [
    "border border-brand-gold bg-gradient-to-r from-brand-gold/30 to-transparent",
    "border border-white/20 bg-white/5",
    "border border-white/10 bg-white/5",
  ] as const;
  const rankSizes = ["text-[60px]", "text-[48px]", "text-[40px]"] as const;
  const countSizes = [
    "text-[56px]",
    variant === 1 ? "text-[56px]" : variant === 2 ? "text-[44px]" : "text-[36px]",
  ] as const;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl px-6 transition-transform duration-300",
        heights[variant - 1],
        borders[variant - 1],
        item.pulse && "scale-105",
        item.isNew && "animate-slideIn",
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[48px] leading-none">{medals[variant - 1]}</span>
        <span
          className={cn("font-black leading-none", rankSizes[variant - 1], rankColors[variant - 1])}
        >
          {item.rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/60">{item.booth_number}</p>
        <p className={cn("truncate font-bold text-white", variant === 1 ? "text-[22px]" : "text-[18px]")}>
          {item.company_name}
        </p>
        <p className="mt-0.5 text-xs text-white/50">今日访客</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-end justify-end gap-1">
          <span className={cn("font-black leading-none text-brand-gold", countSizes[variant - 1])}>
            {item.today_visitors}
          </span>
          <span className="mb-1 text-[20px] text-brand-gold">位</span>
        </div>
        <ChangeBadge change={item.change} />
      </div>
    </div>
  );
}

function CompactRow({
  item,
  highlightGrowth,
  maxChange,
}: {
  item: DisplayRow;
  highlightGrowth: boolean;
  maxChange: number;
}) {
  const trend =
    item.change > 0 ? (
      <span className="text-sm text-brand-green">↑</span>
    ) : (
      <span className="text-sm text-white/30">—</span>
    );

  return (
    <div
      className={cn(
        "flex h-[56px] items-center gap-3 rounded-xl bg-white/5 px-4 transition-transform duration-300",
        item.pulse && "scale-[1.03]",
        item.isNew && "animate-slideIn",
        highlightGrowth &&
          maxChange > 0 &&
          item.change === maxChange &&
          "animate-pulse border-2 border-brand-gold",
      )}
    >
      <RankDeltaBadge delta={item.rankDelta} />
      <span className="w-12 shrink-0 text-xl font-bold text-white/40">{item.rank}</span>
      <span className="min-w-0 flex-1 truncate text-[16px] text-white">
        <span className="text-white/50">{item.booth_number}</span>
        {" · "}
        {item.company_name}
      </span>
      <span className="shrink-0 text-[20px] font-bold text-white">{item.today_visitors}</span>
      {trend}
    </div>
  );
}

export function BoothRankingDisplay({ eventId }: { eventId: string }) {
  const autoRefresh = useBigscreenStore((s) => s.boothRankingAutoRefresh);
  const topLimit = useBigscreenStore((s) => s.boothRankingTopLimit);
  const highlightGrowth = useBigscreenStore((s) => s.boothRankingHighlightGrowth);
  const refreshNonce = useBigscreenStore((s) => s.boothRankingRefreshNonce);

  const prevRankMapRef = useRef<Map<string, number>>(new Map());
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["booth-rankings", eventId, refreshNonce],
    queryFn: () => fetchRankings(eventId),
    refetchInterval: autoRefresh ? 60_000 : false,
  });

  const displayRows = useMemo((): DisplayRow[] => {
    const rankings = data?.rankings ?? [];
    const limit = topLimit === "all" ? rankings.length : topLimit;
    const sliced = rankings.slice(0, limit);

    return sliced.map((item) => {
      const prevRank = prevRankMapRef.current.get(item.booth_id);
      const rankDelta =
        prevRank != null ? prevRank - item.rank : null;
      const isNew = prevRank == null && prevRankMapRef.current.size > 0;
      return {
        ...item,
        rankDelta,
        isNew,
        pulse: pulseIds.has(item.booth_id),
      };
    });
  }, [data, topLimit, pulseIds]);

  useEffect(() => {
    if (!data?.rankings) return;

    const nextPulse = new Set<string>();
    const nextMap = new Map<string, number>();

    for (const item of data.rankings) {
      nextMap.set(item.booth_id, item.rank);
      const prevRank = prevRankMapRef.current.get(item.booth_id);
      if (prevRank != null && prevRank !== item.rank) {
        nextPulse.add(item.booth_id);
      }
      if (prevRank == null && prevRankMapRef.current.size > 0) {
        nextPulse.add(item.booth_id);
      }
    }

    if (nextPulse.size > 0) {
      setPulseIds(nextPulse);
      const timer = setTimeout(() => setPulseIds(new Set()), 300);
      prevRankMapRef.current = nextMap;
      return () => clearTimeout(timer);
    }

    prevRankMapRef.current = nextMap;
  }, [data]);

  const top3 = displayRows.filter((r) => r.rank <= 3);
  const rest = displayRows.filter((r) => r.rank > 3);
  const maxChange = Math.max(...displayRows.map((r) => r.change), 0);
  const eventName = data?.event_name ?? "活动现场";

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(239,159,39,0.08) 0%, #1A1A2E 25%, #1A1A2E 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-gold/10 to-transparent" />

      <div className="relative z-10 pt-24 text-center">
        <h1 className="text-[28px] font-bold text-white">🏆 展位人气排行榜</h1>
        <p className="mt-2 text-sm text-white/50">实时更新 · {eventName}</p>
      </div>

      <div className="relative z-10 mt-8 flex-1 space-y-4 overflow-y-auto px-12 pb-16">
        {top3.map((item) => {
          if (item.rank > 3) return null;
          return (
            <TopThreeCard
              key={item.booth_id}
              item={item}
              variant={item.rank as 1 | 2 | 3}
            />
          );
        })}
        {rest.map((item) => (
          <CompactRow
            key={item.booth_id}
            item={item}
            highlightGrowth={highlightGrowth}
            maxChange={maxChange}
          />
        ))}
        {displayRows.length === 0 && (
          <p className="py-20 text-center text-white/40">暂无展位数据</p>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 w-[72%] py-3 text-center text-sm text-white/30">
        数据每 60 秒自动刷新 · 数据来源：ConnectIQ 签到系统
      </footer>
    </div>
  );
}
