/**
 * Supabase Realtime — 管理者面板「实时概览」频道约定
 *
 * ## Channel 命名
 *
 * | 频道 | 用途 | 监听表 / 事件 |
 * |------|------|----------------|
 * | `event:{eventId}:checkins` | 签到流 | `check_ins` INSERT；`participants` INSERT |
 * | `event:{eventId}:connections` | 连接数 | `business_connections` INSERT |
 * | `event:{eventId}:booth-heat` | 展位热度 | `leads` INSERT（按 booth 归属 event 过滤） |
 * | `event:{eventId}:interactions` | 互动参与 | `poll_responses` INSERT |
 *
 * ## 客户端订阅
 *
 * ```ts
 * import { subscribeEventLiveStats } from "@/lib/realtime/subscribe-live-stats";
 *
 * const unsubscribe = subscribeEventLiveStats(eventId, () => {
 *   void refetchLiveStats();
 * });
 * ```
 *
 * ## 降级轮询
 *
 * Realtime 不可用或未配置 Supabase 时，轮询：
 * `GET /api/events/{eventId}/live-stats`（建议间隔 15s）
 *
 * ## Replication
 *
 * 在 Supabase 执行 `apps/web/supabase/migrations/*_enable_realtime_live_stats.sql`
 * 将下列表加入 `supabase_realtime` publication。
 */

export type LiveStatsChannelKind =
  | "checkins"
  | "connections"
  | "booth-heat"
  | "interactions";

/** Realtime postgres_changes 监听的表（schema: public） */
export const LIVE_STATS_REALTIME_TABLES = [
  "check_ins",
  "participants",
  "business_connections",
  "leads",
  "poll_responses",
] as const;

export type LiveStatsRealtimeTable = (typeof LIVE_STATS_REALTIME_TABLES)[number];

export const LIVE_STATS_CHANNEL_PREFIX = "event" as const;

export const LIVE_STATS_POLL_INTERVAL_MS = 15_000;

export function liveStatsChannelName(
  eventId: string,
  kind: LiveStatsChannelKind,
): string {
  return `${LIVE_STATS_CHANNEL_PREFIX}:${eventId}:${kind}`;
}

/** 四个分频道（细粒度订阅） */
export function liveStatsChannelNames(eventId: string): Record<
  LiveStatsChannelKind,
  string
> {
  return {
    checkins: liveStatsChannelName(eventId, "checkins"),
    connections: liveStatsChannelName(eventId, "connections"),
    "booth-heat": liveStatsChannelName(eventId, "booth-heat"),
    interactions: liveStatsChannelName(eventId, "interactions"),
  };
}

/** 聚合频道：单 channel 订阅全部 live-stats 表变更（Live Ops 页推荐） */
export function liveStatsAggregateChannelName(eventId: string): string {
  return `${LIVE_STATS_CHANNEL_PREFIX}:${eventId}:live-stats`;
}

export const LIVE_STATS_REALTIME_DOC = {
  channels: {
    checkins: {
      name: "event:{eventId}:checkins",
      tables: [
        { table: "check_ins", events: ["INSERT"], filter: "event_id=eq.{eventId}" },
        { table: "participants", events: ["INSERT"], filter: "event_id=eq.{eventId}" },
      ],
    },
    connections: {
      name: "event:{eventId}:connections",
      tables: [
        {
          table: "business_connections",
          events: ["INSERT"],
          filter: "event_id=eq.{eventId}",
        },
      ],
    },
    boothHeat: {
      name: "event:{eventId}:booth-heat",
      tables: [
        {
          table: "leads",
          events: ["INSERT", "UPDATE"],
          filter: "无 event_id 列，客户端收到变更后 refetch live-stats",
        },
      ],
    },
    interactions: {
      name: "event:{eventId}:interactions",
      tables: [
        {
          table: "poll_responses",
          events: ["INSERT"],
          filter: "无 event_id 列，客户端收到变更后 refetch live-stats",
        },
      ],
    },
  },
  fallback: {
    endpoint: "/api/events/{eventId}/live-stats",
    intervalMs: LIVE_STATS_POLL_INTERVAL_MS,
  },
} as const;
