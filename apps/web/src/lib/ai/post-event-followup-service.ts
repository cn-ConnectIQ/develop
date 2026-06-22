import {
  ConnectionStatus,
  FeedItemType,
  prisma,
} from "@connectiq/database";

export type FollowupPhase = "PHASE_24H" | "PHASE_72H" | "PHASE_7D" | "PHASE_30D";

const PHASE_THRESHOLDS: Array<{ phase: FollowupPhase; minHours: number; maxHours: number }> =
  [
    { phase: "PHASE_24H", minHours: 23, maxHours: 25 },
    { phase: "PHASE_72H", minHours: 71, maxHours: 73 },
    { phase: "PHASE_7D", minHours: 167, maxHours: 169 },
    { phase: "PHASE_30D", minHours: 719, maxHours: 721 },
  ];

const PHASE_CONFIG: Record<
  FollowupPhase,
  { title: string; body: (connectionsCount: number, recommendCount: number) => string; aiScore: number }
> = {
  PHASE_24H: {
    title: "🤝 活动结束了，趁热打铁！",
    body: (total, recommend) =>
      `你在昨天的活动里建立了 ${total} 个商务连接。建议优先跟进这 ${recommend} 位，现在发一条问候消息，成功率最高。`,
    aiScore: 5,
  },
  PHASE_72H: {
    title: "📋 3 天后，跟进进度如何？",
    body: (total) =>
      `你在活动里认识了 ${total} 位商务伙伴，已过去 3 天。现在是发送产品资料或邀请试用的好时机。`,
    aiScore: 4,
  },
  PHASE_7D: {
    title: "⏰ 7 天了，还记得在活动里认识的人吗？",
    body: (total) =>
      `你与 ${total} 位活动联系人已建立连接。AI 建议：现在是发出正式合作提案的最佳时机。`,
    aiScore: 3,
  },
  PHASE_30D: {
    title: "📊 月度商机洞察",
    body: (total) =>
      `本月你通过活动新增 ${total} 个商业连接。其中 ${Math.max(1, Math.floor(total * 0.3))} 个有潜在合作价值，建议本月内完成初步洽谈。`,
    aiScore: 3,
  },
};

export type PostEventFollowupResult = {
  eventsProcessed: number;
  phasesTriggered: number;
  feedsCreated: number;
  notificationsCreated: number;
};

async function resolveEventParticipantUserIds(eventId: string): Promise<string[]> {
  const participants = await prisma.participant.findMany({
    where: { eventId },
    select: { email: true, phone: true },
  });

  const emails = [...new Set(participants.map((p) => p.email).filter(Boolean) as string[])];
  const phones = [...new Set(participants.map((p) => p.phone).filter(Boolean) as string[])];

  if (emails.length === 0 && phones.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: { id: true },
  });

  return [...new Set(users.map((u) => u.id))];
}

function parsePhaseFromContent(content: string): FollowupPhase | null {
  try {
    const parsed = JSON.parse(content) as { phase?: string };
    if (
      parsed.phase === "PHASE_24H" ||
      parsed.phase === "PHASE_72H" ||
      parsed.phase === "PHASE_7D" ||
      parsed.phase === "PHASE_30D"
    ) {
      return parsed.phase;
    }
  } catch {
    // ignore
  }
  return null;
}

async function hasPhaseReminder(userId: string, eventId: string, phase: FollowupPhase) {
  const existing = await prisma.feedItem.findMany({
    where: {
      userId,
      eventId,
      type: FeedItemType.REMINDER,
    },
    select: { content: true },
    take: 20,
  });

  return existing.some((row) => parsePhaseFromContent(row.content) === phase);
}

function getOtherParty(
  connection: {
    userAId: string | null;
    userBId: string | null;
    userAName: string;
    userBName: string;
    userACompany: string | null;
    userBCompany: string | null;
  },
  userId: string,
) {
  if (connection.userAId === userId) {
    return {
      userId: connection.userBId,
      name: connection.userBName,
      company: connection.userBCompany,
    };
  }
  return {
    userId: connection.userAId,
    name: connection.userAName,
    company: connection.userACompany,
  };
}

async function sendFollowupPhase(
  eventId: string,
  phase: FollowupPhase,
  now: Date,
): Promise<{ feedsCreated: number; notificationsCreated: number }> {
  const userIds = await resolveEventParticipantUserIds(eventId);
  let feedsCreated = 0;
  let notificationsCreated = 0;

  for (const userId of userIds) {
    const connections = await prisma.businessConnection.findMany({
      where: {
        status: ConnectionStatus.ACTIVE,
        eventId,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        interactions: { select: { id: true }, take: 1 },
      },
      orderBy: [{ aiScore: "desc" }, { createdAt: "desc" }],
    });

    if (connections.length === 0) continue;

    const highValueUnfollowed = connections
      .filter((connection) => connection.interactions.length === 0)
      .slice(0, 3);

    const recommended = highValueUnfollowed.length > 0
      ? highValueUnfollowed
      : connections.slice(0, 3);

    if (recommended.length === 0) continue;

    if (await hasPhaseReminder(userId, eventId, phase)) continue;

    const config = PHASE_CONFIG[phase];
    const recommendCount = recommended.length;

    await prisma.feedItem.create({
      data: {
        userId,
        eventId,
        type: FeedItemType.REMINDER,
        aiScore: config.aiScore,
        triggerReason: config.body(connections.length, recommendCount),
        content: JSON.stringify({
          phase,
          connections_count: connections.length,
          recommended_contacts: recommended.map((connection) => {
            const other = getOtherParty(connection, userId);
            return {
              user_id: other.userId,
              name: other.name,
              company: other.company,
            };
          }),
        }),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    feedsCreated += 1;

    await prisma.notification.create({
      data: {
        userId,
        title: config.title,
        body: config.body(connections.length, recommendCount),
      },
    });
    notificationsCreated += 1;
  }

  return { feedsCreated, notificationsCreated };
}

export async function runPostEventFollowup(
  now = new Date(),
): Promise<PostEventFollowupResult> {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentEndedEvents = await prisma.event.findMany({
    where: {
      endDate: {
        gte: thirtyDaysAgo,
        lt: now,
      },
    },
    select: { id: true, endDate: true },
  });

  let phasesTriggered = 0;
  let feedsCreated = 0;
  let notificationsCreated = 0;

  for (const event of recentEndedEvents) {
    if (!event.endDate) continue;

    const hoursAfterEnd =
      (now.getTime() - event.endDate.getTime()) / (1000 * 60 * 60);

    for (const { phase, minHours, maxHours } of PHASE_THRESHOLDS) {
      if (hoursAfterEnd >= minHours && hoursAfterEnd < maxHours) {
        const result = await sendFollowupPhase(event.id, phase, now);
        phasesTriggered += 1;
        feedsCreated += result.feedsCreated;
        notificationsCreated += result.notificationsCreated;
      }
    }
  }

  return {
    eventsProcessed: recentEndedEvents.length,
    phasesTriggered,
    feedsCreated,
    notificationsCreated,
  };
}
