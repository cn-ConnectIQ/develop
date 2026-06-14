"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRealtimeCheckin } from "@/hooks/useRealtimeCheckin";
import type { CheckinDashboardData } from "@/lib/checkin-types";
import { cn } from "@/lib/utils";

async function fetchCheckin(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/checkin`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as CheckinDashboardData;
}

function BigscreenCounter({ value }: { value: number }) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <p
      className={cn(
        "text-[120px] leading-none font-black tabular-nums transition-transform duration-300",
        pulse && "scale-105",
      )}
    >
      {value}
    </p>
  );
}

export function CheckinBigscreenClient({ eventId }: { eventId: string }) {
  const [now, setNow] = useState(new Date());

  const { data, refetch } = useQuery({
    queryKey: ["checkin-bigscreen", eventId],
    queryFn: () => fetchCheckin(eventId),
    refetchInterval: 15000,
  });

  useRealtimeCheckin({
    eventId,
    onCheckin: () => void refetch(),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = data?.stats;
  const recent = data?.recent?.slice(0, 8) ?? [];

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-sidebar-shell text-white">
      <header className="flex shrink-0 items-center justify-between px-12 pt-8">
        <p className="text-lg text-white">{data?.event.name ?? "签到看板"}</p>
        <p className="font-mono text-2xl tabular-nums text-white">
          {format(now, "HH:mm:ss")}
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center">
        <BigscreenCounter value={stats?.checkedIn ?? 0} />
        <p className="mt-2 text-4xl text-white/60">
          / {stats?.total ?? 0} 已签到
        </p>
        <div className="mt-8 h-5 w-[600px] max-w-[80vw] overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-brand-blue transition-all duration-500"
            style={{ width: `${stats?.rate ?? 0}%` }}
          />
        </div>
        <p className="mt-4 text-4xl font-bold text-brand-blue tabular-nums">
          {stats?.rate ?? 0}%
        </p>
      </main>

      <aside className="absolute top-32 right-12 w-72">
        <div className="flex flex-col gap-3">
          {recent.length === 0 ? (
            <p className="text-sm text-white/40">等待签到…</p>
          ) : (
            recent.map((item) => (
              <BigscreenFeedItem key={item.id} item={item} allItems={recent} />
            ))
          )}
        </div>
      </aside>

      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/40">
        ConnectIQ
      </footer>
    </div>
  );
}

function BigscreenFeedItem({
  item,
  allItems,
}: {
  item: CheckinDashboardData["recent"][number];
  allItems: CheckinDashboardData["recent"];
}) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const currentIds = new Set(allItems.map((i) => i.id));
    if (!prevIdsRef.current.has(item.id) && prevIdsRef.current.size > 0) {
      setIsNew(true);
      const t = setTimeout(() => setIsNew(false), 600);
      prevIdsRef.current = currentIds;
      return () => clearTimeout(t);
    }
    prevIdsRef.current = currentIds;
  }, [allItems, item.id]);

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        isNew && "animate-in slide-in-from-bottom-4 fade-in duration-300",
      )}
    >
      <Avatar className="size-10">
        <AvatarFallback className="bg-white/10 text-base text-white">
          {item.name.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-lg text-white">{item.name}</p>
        <p className="truncate text-sm text-white/60">{item.company ?? "—"}</p>
      </div>
    </div>
  );
}
