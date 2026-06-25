import {
  ConnectionStatus,
  LotteryStatus,
  PollStatus,
  SignalType,
  prisma,
} from "@connectiq/database";
import type { InteractionRef } from "@/lib/interaction/schemas";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import {
  computeAiIntentFromSignals,
  computeLeadAiIntentLevel,
  type AiIntentLevel,
} from "@/lib/exhibitor/lead-intent-service";

function dayStart(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function buildRecommendReason(
  signals: Array<{ signalType: SignalType; payload: unknown }>,
  boothName: string,
): string {
  const parts: string[] = [];
  if (signals.some((s) => s.signalType === SignalType.BOOTH_LEAD_CAPTURED)) {
    parts.push("已留下联系方式");
  }
  if (signals.some((s) => s.signalType === SignalType.POLL_ANSWERED)) {
    parts.push("参与了展位投票");
  }
  if (signals.some((s) => s.signalType === SignalType.QNA_ASKED)) {
    parts.push("向展位提交了提问");
  }
  if (signals.some((s) => s.signalType === SignalType.INTERACTION_JOINED)) {
    parts.push("加入了展位互动");
  }
  if (signals.filter((s) => s.signalType === SignalType.BOOTH_SCAN).length >= 2) {
    parts.push("多次到访展位");
  }

  if (parts.length === 0) {
    return `对 ${boothName} 表现出兴趣`;
  }
  return parts.join("，");
}

export async function getExhibitorDashboardStats(boothId: string, eventId: string) {
  const todayStart = dayStart();
  const yesterdayStart = dayStart(-1);

  const [
    todayVisitors,
    yesterdayVisitors,
    todayLeads,
    gradeALeads,
    interactionSessions,
    aiRecommendedCount,
    pendingContactCount,
  ] = await Promise.all([
    prisma.boothVisitSignal.count({
      where: {
        eventId,
        entityId: boothId,
        signalType: SignalType.BOOTH_SCAN,
        occurredAt: { gte: todayStart },
      },
    }),
    prisma.boothVisitSignal.count({
      where: {
        eventId,
        entityId: boothId,
        signalType: SignalType.BOOTH_SCAN,
        occurredAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.lead.count({
      where: { boothId, createdAt: { gte: todayStart } },
    }),
    prisma.lead.count({
      where: {
        boothId,
        OR: [
          { intentGrade: "A" },
          {
            intentTags: {
              some: {
                intentTag: {
                  OR: [
                    { label: { contains: "采购" } },
                    { label: { contains: "投资" } },
                  ],
                },
              },
            },
          },
        ],
      },
    }),
    prisma.interactionSession.findMany({
      where: { boothId },
      select: { participantCount: true, interactions: true },
    }),
    prisma.boothVisitSignal
      .groupBy({
        by: ["userId"],
        where: {
          eventId,
          entityId: boothId,
          signalType: {
            in: [SignalType.BOOTH_LEAD_CAPTURED, SignalType.BOOTH_SCAN],
          },
          occurredAt: { gte: todayStart },
        },
      })
      .then((rows) => rows.length),
    countPendingAiContacts(boothId, eventId),
  ]);

  let interactionParticipants = 0;
  for (const session of interactionSessions) {
    interactionParticipants += session.participantCount;
  }

  const visitorDelta = todayVisitors - yesterdayVisitors;

  const hourlyTrend = await buildHourlyTrend(boothId, eventId, todayStart);

  const liveInteractions = await listLiveInteractions(boothId);

  return {
    today_visitors: todayVisitors,
    visitor_delta: visitorDelta,
    leads_today: todayLeads,
    grade_a_leads: gradeALeads,
    interaction_participants: interactionParticipants,
    ai_recommended_count: aiRecommendedCount,
    pending_contact_count: pendingContactCount,
    hourly_trend: hourlyTrend,
    live_interactions: liveInteractions,
  };
}

async function countPendingAiContacts(boothId: string, eventId: string) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: { operatorUserId: true, companyOrg: { select: { ownerId: true } } },
  });
  const exhibitorUserId =
    booth?.operatorUserId ?? booth?.companyOrg.ownerId ?? null;
  if (!exhibitorUserId) return 0;

  const signals = await prisma.boothVisitSignal.findMany({
    where: {
      eventId,
      entityId: boothId,
      signalType: { in: [SignalType.BOOTH_LEAD_CAPTURED, SignalType.BOOTH_SCAN] },
      occurredAt: { gte: dayStart() },
    },
    distinct: ["userId"],
    select: { userId: true },
  });

  if (signals.length === 0) return 0;

  const buyerIds = signals.map((s) => s.userId);
  const connected = await prisma.businessConnection.findMany({
    where: {
      status: ConnectionStatus.ACTIVE,
      OR: [
        { userAId: exhibitorUserId, userBId: { in: buyerIds } },
        { userBId: exhibitorUserId, userAId: { in: buyerIds } },
      ],
    },
    select: { userAId: true, userBId: true },
  });

  const connectedSet = new Set<string>();
  for (const c of connected) {
    if (c.userAId && c.userAId !== exhibitorUserId) connectedSet.add(c.userAId);
    if (c.userBId && c.userBId !== exhibitorUserId) connectedSet.add(c.userBId);
  }

  return buyerIds.filter((id) => !connectedSet.has(id)).length;
}

async function buildHourlyTrend(
  boothId: string,
  eventId: string,
  todayStart: Date,
) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    visitors: 0,
    leads: 0,
  }));

  const [scanSignals, leads] = await Promise.all([
    prisma.boothVisitSignal.findMany({
      where: {
        eventId,
        entityId: boothId,
        signalType: SignalType.BOOTH_SCAN,
        occurredAt: { gte: todayStart },
      },
      select: { occurredAt: true },
    }),
    prisma.lead.findMany({
      where: { boothId, createdAt: { gte: todayStart } },
      select: { createdAt: true },
    }),
  ]);

  for (const s of scanSignals) {
    buckets[s.occurredAt.getHours()]!.visitors += 1;
  }
  for (const l of leads) {
    buckets[l.createdAt.getHours()]!.leads += 1;
  }

  return buckets;
}

async function listLiveInteractions(boothId: string) {
  const sessions = await prisma.interactionSession.findMany({
    where: { boothId, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      participantCount: true,
      interactions: true,
    },
  });

  const items = await Promise.all(
    sessions.map(async (session) => {
      const refs = Array.isArray(session.interactions)
        ? (session.interactions as InteractionRef[])
        : [];
      const ref = refs[0];
      if (!ref) return null;

      if (ref.type === "poll") {
        const poll = await prisma.poll.findUnique({
          where: { id: ref.id },
          select: { status: true, type: true },
        });
        if (!poll || poll.status !== PollStatus.LIVE) return null;
        return {
          session_id: session.id,
          title: session.name,
          kind: "poll" as const,
          sub_type: poll.type,
          participant_count: session.participantCount,
          status: poll.status,
        };
      }

      if (ref.type === "lottery") {
        const lottery = await prisma.lottery.findUnique({
          where: { id: ref.id },
          select: { status: true, type: true },
        });
        if (!lottery || lottery.status !== LotteryStatus.OPEN) return null;
        return {
          session_id: session.id,
          title: session.name,
          kind: "lottery" as const,
          sub_type: lottery.type,
          participant_count: session.participantCount,
          status: lottery.status,
        };
      }

      return null;
    }),
  );

  return items.filter(Boolean);
}

export type RecommendedBuyer = {
  buyer_user_id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  intent_level: AiIntentLevel;
  recommend_reason: string;
  occurred_at: string;
  pending_contact: boolean;
};

export async function listRecommendedBuyers(
  boothId: string,
  eventId: string,
  exhibitorUserId: string | null,
  limit = 5,
): Promise<RecommendedBuyer[]> {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: { name: true },
  });
  const boothName = booth?.name ?? "你的展位";

  const todayStart = dayStart();
  const signals = await prisma.boothVisitSignal.findMany({
    where: {
      eventId,
      entityId: boothId,
      occurredAt: { gte: todayStart },
    },
    orderBy: { occurredAt: "desc" },
    select: {
      userId: true,
      signalType: true,
      payload: true,
      occurredAt: true,
    },
  });

  const byUser = new Map<
    string,
    Array<{ signalType: SignalType; payload: unknown; occurredAt: Date }>
  >();
  for (const s of signals) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const ranked: Array<{
    userId: string;
    intentLevel: AiIntentLevel;
    occurredAt: Date;
    reason: string;
  }> = [];

  for (const [userId, userSignals] of byUser) {
    const boothSignals = userSignals.map((s) => ({ signalType: s.signalType }));
    const intentLevel = computeAiIntentFromSignals(boothSignals);
    if (intentLevel === "C" && !userSignals.some((s) => s.signalType === SignalType.BOOTH_LEAD_CAPTURED)) {
      continue;
    }
    ranked.push({
      userId,
      intentLevel,
      occurredAt: userSignals[0]!.occurredAt,
      reason: buildRecommendReason(userSignals, boothName),
    });
  }

  ranked.sort((a, b) => {
    const score = (l: AiIntentLevel) => (l === "A" ? 3 : l === "B" ? 2 : 1);
    if (score(a.intentLevel) !== score(b.intentLevel)) {
      return score(b.intentLevel) - score(a.intentLevel);
    }
    return b.occurredAt.getTime() - a.occurredAt.getTime();
  });

  const top = ranked.slice(0, limit);
  if (top.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: top.map((r) => r.userId) } },
    select: {
      id: true,
      name: true,
      profile: { select: { company: true } },
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const jobTitleByUser = new Map<string, string | null>();
  await Promise.all(
    top.map(async (row) => {
      const participant = await findParticipantForUser(eventId, row.userId);
      jobTitleByUser.set(row.userId, participant?.jobTitle ?? null);
    }),
  );

  let connectedSet = new Set<string>();
  if (exhibitorUserId) {
    const connections = await prisma.businessConnection.findMany({
      where: {
        status: ConnectionStatus.ACTIVE,
        OR: [
          { userAId: exhibitorUserId },
          { userBId: exhibitorUserId },
        ],
      },
      select: { userAId: true, userBId: true },
    });
    for (const c of connections) {
      const peer =
        c.userAId === exhibitorUserId ? c.userBId : c.userAId;
      if (peer) connectedSet.add(peer);
    }
  }

  return top.map((row) => {
    const user = userById.get(row.userId);
    return {
      buyer_user_id: row.userId,
      name: user?.name ?? "访客",
      company: user?.profile?.company ?? null,
      job_title: jobTitleByUser.get(row.userId) ?? null,
      intent_level: row.intentLevel,
      recommend_reason: row.reason,
      occurred_at: row.occurredAt.toISOString(),
      pending_contact: !connectedSet.has(row.userId),
    };
  });
}

export type ExhibitorLeadItem = {
  id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  ai_intent_level: AiIntentLevel;
  intent_grade: string | null;
  status: string;
  created_at: string;
  crm_sync_status: string;
};

export async function listExhibitorLeads(
  boothId: string,
  eventId: string,
  limit = 8,
): Promise<ExhibitorLeadItem[]> {
  const leads = await prisma.lead.findMany({
    where: { boothId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      participant: {
        select: {
          name: true,
          company: true,
          jobTitle: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return Promise.all(
    leads.map(async (lead) => {
      const aiLevel = await computeLeadAiIntentLevel(
        boothId,
        eventId,
        lead.participant,
        lead.intentGrade,
      );
      return {
        id: lead.id,
        name: lead.participant.name,
        company: lead.participant.company,
        job_title: lead.participant.jobTitle,
        ai_intent_level: aiLevel,
        intent_grade: lead.intentGrade,
        status: lead.status,
        created_at: lead.createdAt.toISOString(),
        crm_sync_status: lead.crmSyncStatus,
      };
    }),
  );
}

export async function patchExhibitorLeadGrade(
  boothId: string,
  leadId: string,
  intentGrade: AiIntentLevel,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, boothId },
  });
  if (!lead) return null;

  return prisma.lead.update({
    where: { id: leadId },
    data: { intentGrade },
    include: {
      participant: {
        select: {
          name: true,
          company: true,
          jobTitle: true,
          email: true,
          phone: true,
        },
      },
    },
  });
}
