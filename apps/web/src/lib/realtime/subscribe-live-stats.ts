"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  liveStatsAggregateChannelName,
  liveStatsChannelName,
  type LiveStatsChannelKind,
} from "@/lib/realtime/channels";

type Unsubscribe = () => void;

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function subscribePostgresChanges(
  channel: RealtimeChannel,
  config: {
    table: string;
    event: "INSERT" | "UPDATE" | "DELETE" | "*";
    filter?: string;
  },
  onChange: () => void,
) {
  channel.on(
    "postgres_changes",
    {
      event: config.event,
      schema: "public",
      table: config.table,
      ...(config.filter ? { filter: config.filter } : {}),
    },
    onChange,
  );
}

/**
 * 订阅单个 live-stats 分频道（checkins / connections / booth-heat / interactions）。
 * 未配置 Supabase 时返回 null（调用方应启用轮询）。
 */
export function subscribeLiveStatsChannel(
  eventId: string,
  kind: LiveStatsChannelKind,
  onUpdate: () => void,
): Unsubscribe | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !eventId) return null;

  const trigger = debounce(onUpdate, 300);
  const channelName = liveStatsChannelName(eventId, kind);
  const channel = supabase.channel(channelName);

  switch (kind) {
    case "checkins":
      subscribePostgresChanges(
        channel,
        { table: "check_ins", event: "INSERT", filter: `event_id=eq.${eventId}` },
        trigger,
      );
      subscribePostgresChanges(
        channel,
        { table: "participants", event: "INSERT", filter: `event_id=eq.${eventId}` },
        trigger,
      );
      break;
    case "connections":
      subscribePostgresChanges(
        channel,
        {
          table: "business_connections",
          event: "INSERT",
          filter: `event_id=eq.${eventId}`,
        },
        trigger,
      );
      break;
    case "booth-heat":
      subscribePostgresChanges(channel, { table: "leads", event: "INSERT" }, trigger);
      subscribePostgresChanges(channel, { table: "leads", event: "UPDATE" }, trigger);
      break;
    case "interactions":
      subscribePostgresChanges(
        channel,
        { table: "poll_responses", event: "INSERT" },
        trigger,
      );
      break;
  }

  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * 聚合订阅：一个 channel 监听所有 live-stats 相关表（Live Ops / AD 实时概览）。
 * 频道名：`event:{eventId}:live-stats`
 */
export function subscribeEventLiveStats(
  eventId: string,
  onUpdate: () => void,
): Unsubscribe | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !eventId) return null;

  const trigger = debounce(onUpdate, 300);
  const channel = supabase.channel(liveStatsAggregateChannelName(eventId));

  subscribePostgresChanges(
    channel,
    { table: "check_ins", event: "INSERT", filter: `event_id=eq.${eventId}` },
    trigger,
  );
  subscribePostgresChanges(
    channel,
    { table: "participants", event: "INSERT", filter: `event_id=eq.${eventId}` },
    trigger,
  );
  subscribePostgresChanges(
    channel,
    {
      table: "business_connections",
      event: "INSERT",
      filter: `event_id=eq.${eventId}`,
    },
    trigger,
  );
  subscribePostgresChanges(channel, { table: "leads", event: "INSERT" }, trigger);
  subscribePostgresChanges(channel, { table: "leads", event: "UPDATE" }, trigger);
  subscribePostgresChanges(
    channel,
    { table: "poll_responses", event: "INSERT" },
    trigger,
  );

  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** 同时订阅四个分频道（需细粒度 UI 时使用） */
export function subscribeAllLiveStatsChannels(
  eventId: string,
  onUpdate: () => void,
): Unsubscribe | null {
  const kinds: LiveStatsChannelKind[] = [
    "checkins",
    "connections",
    "booth-heat",
    "interactions",
  ];
  const unsubs = kinds
    .map((kind) => subscribeLiveStatsChannel(eventId, kind, onUpdate))
    .filter((fn): fn is Unsubscribe => fn != null);

  if (unsubs.length === 0) return null;
  return () => {
    for (const unsub of unsubs) unsub();
  };
}
