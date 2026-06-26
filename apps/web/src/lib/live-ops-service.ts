import {
  ConnectionStatus,
  LotteryStatus,
  PollStatus,
  prisma,
} from "@connectiq/database";
import { getEventPhase } from "@/lib/event-utils";
import { getBoothRankings } from "@/lib/booth-rankings-service";
import { LIVE_STATS_REALTIME_TABLES } from "@/lib/realtime/channels";
import type { InteractionRef } from "@/lib/interaction/schemas";
import { buildHourlyBuckets, calcCheckinRate } from "@/lib/checkin";

export type LiveOpsStatusBar = {
  checked_in: number;
  on_site: number;
  connections: number;
  live_interactions: number;
  trends: {
    checked_in: number;
    on_site: number;
    connections: number;
    live_interactions: number;
  };
};

export type LiveOpsCheckinItem = {
  id: string;
  name: string;
  company: string | null;
  checked_in_at: string;
};

export type LiveOpsVelocityBucket = {
  label: string;
  count: number;
};

export type LiveOpsInteractionItem = {
  session_id: string;
  title: string;
  kind: "poll" | "lottery";
  sub_type: string;
  owner_label: string;
  owner_type: "ORGANIZER" | "EXHIBITOR";
  participant_count: number;
  booth_id: string | null;
  interaction_id: string;
};

export type LiveOpsConnectionBlock = {
  total: number;
  trend_delta: number;
  peak_hint: string;
  ai_ratio: number;
  hourly: Array<{ hour: string; count: number }>;
};

export type LiveOpsBoothHeatItem = {
  booth_id: string;
  booth_number: string;
  company_name: string;
  today_visitors: number;
  change: number;
  rank: number;
};

export type LiveOpsPayload = {
  event: {
    id: string;
    name: string;
    status: string;
    phase: string;
  };
  status_bar: LiveOpsStatusBar;
  checkin: {
    rate: number;
    participant_total: number;
    recent: LiveOpsCheckinItem[];
    velocity: LiveOpsVelocityBucket[];
  };
  interactions: LiveOpsInteractionItem[];
  connections: LiveOpsConnectionBlock;
  booth_heat: {
    top: LiveOpsBoothHeatItem[];
    cold: LiveOpsBoothHeatItem[];
  };
  realtime: {
    tables: string[];
    event_id: string;
    aggregate_channel: string;
    poll_fallback: string;
  };
};

function buildVelocity10Min(checkIns: { checkedInAt: Date }[]): LiveOpsVelocityBucket[] {
  const now = new Date();
  const buckets: LiveOpsVelocityBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 10 * 60 * 1000);
    const start = new Date(end.getTime() - 10 * 60 * 1000);
    const count = checkIns.filter(
      (c) => c.checkedInAt >= start && c.checkedInAt < end,
    ).length;
    const label = `${String(start.getHours()).padStart(2, "0")}:${String(
      Math.floor(start.getMinutes() / 10) * 10,
    ).padStart(2, "0")}`;
    buckets.push({ label, count });
  }
  return buckets;
}

function countInWindow<T extends { createdAt?: Date; checkedInAt?: Date; occurredAt?: Date }>(
  rows: T[],
  field: "createdAt" | "checkedInAt" | "occurredAt",
  startMs: number,
  endMs: number,
) {
  return rows.filter((r) => {
    const t = r[field]?.getTime();
    return t !== undefined && t >= startMs && t < endMs;
  }).length;
}

async function listLiveInteractions(eventId: string): Promise<LiveOpsInteractionItem[]> {
  const sessions = await prisma.interactionSession.findMany({
    where: { eventId, isActive: true },
    include: {
      booth: {
        select: {
          id: true,
          code: true,
          companyOrg: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: LiveOpsInteractionItem[] = [];

  for (const session of sessions) {
    const refs = Array.isArray(session.interactions)
      ? (session.interactions as InteractionRef[])
      : [];
    const ref = refs[0];
    if (!ref) continue;

    const ownerType = session.ownerType as "ORGANIZER" | "EXHIBITOR";
    const ownerLabel =
      ownerType === "EXHIBITOR" && session.booth
        ? `${session.booth.companyOrg.name} · ${session.booth.code}`
        : "主办方";

    if (ref.type === "poll") {
      const poll = await prisma.poll.findUnique({
        where: { id: ref.id },
        select: { id: true, type: true, status: true, title: true },
      });
      if (!poll || poll.status !== PollStatus.LIVE) continue;
      items.push({
        session_id: session.id,
        title: poll.title,
        kind: "poll",
        sub_type: poll.type,
        owner_label: ownerLabel,
        owner_type: ownerType,
        participant_count: session.participantCount,
        booth_id: session.boothId,
        interaction_id: poll.id,
      });
    } else if (ref.type === "lottery") {
      const lottery = await prisma.lottery.findUnique({
        where: { id: ref.id },
        select: { id: true, type: true, status: true, title: true },
      });
      if (!lottery || lottery.status !== LotteryStatus.OPEN) continue;
      items.push({
        session_id: session.id,
        title: lottery.title,
        kind: "lottery",
        sub_type: lottery.type,
        owner_label: ownerLabel,
        owner_type: ownerType,
        participant_count: session.participantCount,
        booth_id: session.boothId,
        interaction_id: lottery.id,
      });
    }
  }

  return items;
}

function buildPeakHint(hourly: Array<{ hour: string; count: number }>): string {
  if (hourly.length === 0) return "暂无连接数据";
  const peak = hourly.reduce((best, cur) =>
    cur.count > best.count ? cur : best,
  );
  if (peak.count === 0) return "连接活动尚未开始";
  const hourNum = parseInt(peak.hour, 10);
  if (hourNum >= 11 && hourNum <= 14) {
    return `茶歇时段（${peak.hour} 前后）连接激增`;
  }
  return `${peak.hour} 时段连接最活跃（${peak.count} 次）`;
}

export async function getLiveOpsData(eventId: string): Promise<LiveOpsPayload> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!event) {
    throw new Error("活动不存在");
  }

  const phase = getEventPhase(event);
  const now = Date.now();
  const windowRecentStart = now - 5 * 60 * 1000;
  const windowPrevStart = now - 10 * 60 * 1000;

  const [
    participantTotal,
    checkIns,
    recentCheckIns,
    connections,
    interactions,
    boothRankings,
  ] = await Promise.all([
    prisma.participant.count({ where: { eventId } }),
    prisma.checkIn.findMany({
      where: { eventId },
      select: { checkedInAt: true, participantId: true },
    }),
    prisma.checkIn.findMany({
      where: { eventId },
      orderBy: { checkedInAt: "desc" },
      take: 20,
      include: {
        participant: { select: { name: true, company: true } },
      },
    }),
    prisma.businessConnection.findMany({
      where: { eventId, status: ConnectionStatus.ACTIVE },
      select: {
        createdAt: true,
        fromAiMatch: true,
        source: true,
      },
    }),
    listLiveInteractions(eventId),
    getBoothRankings(eventId),
  ]);

  const checkedIn = checkIns.length;
  const checkinRate = calcCheckinRate(checkedIn, participantTotal);

  const recentCheckinDelta = countInWindow(
    checkIns.map((c) => ({ checkedInAt: c.checkedInAt })),
    "checkedInAt",
    windowRecentStart,
    now,
  );
  const prevCheckinDelta = countInWindow(
    checkIns.map((c) => ({ checkedInAt: c.checkedInAt })),
    "checkedInAt",
    windowPrevStart,
    windowRecentStart,
  );

  const recentConnDelta = countInWindow(connections, "createdAt", windowRecentStart, now);
  const prevConnDelta = countInWindow(
    connections,
    "createdAt",
    windowPrevStart,
    windowRecentStart,
  );

  const hourlyConn = buildHourlyBuckets(
    connections.map((c) => ({ checkedInAt: c.createdAt })),
  ).map((b) => ({ hour: b.hour.replace(":00", ""), count: b.count }));

  const aiCount = connections.filter((c) => c.fromAiMatch).length;
  const aiRatio =
    connections.length > 0
      ? Math.round((aiCount / connections.length) * 1000) / 10
      : 0;

  const top = boothRankings.rankings.slice(0, 5);
  const cold = [...boothRankings.rankings]
    .sort((a, b) => a.today_visitors - b.today_visitors)
    .slice(0, 3)
    .filter((b) => b.today_visitors < (top[0]?.today_visitors ?? 1) / 3);

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      phase,
    },
    status_bar: {
      checked_in: checkedIn,
      on_site: checkedIn,
      connections: connections.length,
      live_interactions: interactions.length,
      trends: {
        checked_in: recentCheckinDelta - prevCheckinDelta,
        on_site: recentCheckinDelta - prevCheckinDelta,
        connections: recentConnDelta - prevConnDelta,
        live_interactions: 0,
      },
    },
    checkin: {
      rate: checkinRate,
      participant_total: participantTotal,
      recent: recentCheckIns.map((c) => ({
        id: c.id,
        name: c.participant.name,
        company: c.participant.company,
        checked_in_at: c.checkedInAt.toISOString(),
      })),
      velocity: buildVelocity10Min(checkIns),
    },
    interactions,
    connections: {
      total: connections.length,
      trend_delta: recentConnDelta - prevConnDelta,
      peak_hint: buildPeakHint(hourlyConn),
      ai_ratio: aiRatio,
      hourly: hourlyConn,
    },
    booth_heat: {
      top: top.map((b) => ({
        booth_id: b.booth_id,
        booth_number: b.booth_number,
        company_name: b.company_name,
        today_visitors: b.today_visitors,
        change: b.change,
        rank: b.rank,
      })),
      cold: cold.map((b) => ({
        booth_id: b.booth_id,
        booth_number: b.booth_number,
        company_name: b.company_name,
        today_visitors: b.today_visitors,
        change: b.change,
        rank: b.rank,
      })),
    },
    realtime: {
      tables: [...LIVE_STATS_REALTIME_TABLES],
      event_id: eventId,
      aggregate_channel: `event:${eventId}:live-stats`,
      poll_fallback: `/api/events/${eventId}/live-stats`,
    },
  };
}

export async function broadcastToEvent(
  eventId: string,
  input: { title: string; body: string; urgent?: boolean },
) {
  const { notifyParticipants } = await import("@/lib/participant-notify-service");
  const participants = await prisma.participant.findMany({
    where: { eventId },
    select: { id: true },
  });

  const title = input.urgent ? `🚨 ${input.title}` : input.title;

  return notifyParticipants({
    eventId,
    participantIds: participants.map((p) => p.id),
    title,
    body: input.body,
  });
}

export async function pushStampReminderForBooths(
  eventId: string,
  boothIds: string[],
) {
  const booths = await prisma.exhibitorBooth.findMany({
    where: { id: { in: boothIds }, eventId },
    select: { code: true, companyOrg: { select: { name: true } } },
  });

  const names = booths.map((b) => `${b.companyOrg.name}（${b.code}）`).join("、");
  return broadcastToEvent(eventId, {
    title: "集章打卡提醒",
    body: `别忘了前往 ${names} 展位打卡集章，完成路线可兑换礼品！`,
  });
}
