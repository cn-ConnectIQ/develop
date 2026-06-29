import {
  ConnectionStatus,
  ExchangeStatus,
  FeedItemType,
  ReferralStatus,
  prisma,
} from "@connectiq/database";

const DERIVED_PREFIX = "feed-derived";

function actorPayload(user: {
  id: string;
  name: string;
  profile?: { company: string | null } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    company: user.profile?.company ?? undefined,
  };
}

/**
 * 从交换请求、引荐、待跟进连接等业务数据同步 FeedItem（幂等 upsert）。
 * 失败时不阻塞 GET /api/feed。
 */
export async function syncDerivedFeedItems(userId: string): Promise<void> {
  const [incomingExchanges, pendingReferrals, staleConnections] =
    await Promise.all([
      prisma.exchangeRequest.findMany({
        where: { toUserId: userId, status: ExchangeStatus.PENDING },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              profile: { select: { company: true } },
            },
          },
        },
      }),
      prisma.businessReferral.findMany({
        where: { recipientId: userId, status: ReferralStatus.PENDING },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          eventId: true,
          message: true,
          aiConfidence: true,
          userAName: true,
          userBName: true,
          userACompany: true,
          userBCompany: true,
        },
      }),
      prisma.businessConnection.findMany({
        where: {
          status: ConnectionStatus.ACTIVE,
          OR: [{ userAId: userId }, { userBId: userId }],
          createdAt: { lte: new Date(Date.now() - 7 * 86_400_000) },
        },
        orderBy: { createdAt: "asc" },
        take: 3,
        select: {
          id: true,
          eventId: true,
          userAId: true,
          userBId: true,
          userAName: true,
          userBName: true,
          userACompany: true,
          userBCompany: true,
          createdAt: true,
        },
      }),
    ]);

  for (const req of incomingExchanges) {
    const actor = actorPayload(req.fromUser);
    await prisma.feedItem.upsert({
      where: { id: `${DERIVED_PREFIX}-exchange-${req.id}` },
      update: {
        content: JSON.stringify({
          actor,
          content: `${req.fromUser.name} 想与你交换微信${req.message ? `：${req.message}` : ""}`,
          is_read: false,
          exchange_request_id: req.id,
        }),
        triggerReason: "收到新的连接请求",
      },
      create: {
        id: `${DERIVED_PREFIX}-exchange-${req.id}`,
        userId,
        eventId: req.eventId,
        type: FeedItemType.INSIGHT,
        content: JSON.stringify({
          actor,
          content: `${req.fromUser.name} 想与你交换微信${req.message ? `：${req.message}` : ""}`,
          is_read: false,
          exchange_request_id: req.id,
        }),
        triggerReason: "收到新的连接请求",
      },
    });
  }

  for (const ref of pendingReferrals) {
    const actorA = {
      id: `ref-a-${ref.id}`,
      name: ref.userAName,
      company: ref.userACompany ?? undefined,
    };
    const actorB = {
      id: `ref-b-${ref.id}`,
      name: ref.userBName,
      company: ref.userBCompany ?? undefined,
    };
    const score =
      ref.aiConfidence != null
        ? Math.min(5, Math.max(1, Math.round(ref.aiConfidence * 5)))
        : 4;

    await prisma.feedItem.upsert({
      where: { id: `${DERIVED_PREFIX}-referral-${ref.id}` },
      update: {
        aiScore: score * 20,
        content: JSON.stringify({
          actor_a: actorA,
          actor_b: actorB,
          is_read: false,
          referral_id: ref.id,
        }),
        triggerReason:
          ref.message ?? "AI 认为双方存在引荐价值，建议促成一次正式介绍",
      },
      create: {
        id: `${DERIVED_PREFIX}-referral-${ref.id}`,
        userId,
        eventId: ref.eventId,
        type: FeedItemType.AI_REFERRAL,
        aiScore: score * 20,
        content: JSON.stringify({
          actor_a: actorA,
          actor_b: actorB,
          is_read: false,
          referral_id: ref.id,
        }),
        triggerReason:
          ref.message ?? "AI 认为双方存在引荐价值，建议促成一次正式介绍",
      },
    });
  }

  for (const conn of staleConnections) {
    const isA = conn.userAId === userId;
    const peerName = isA ? conn.userBName : conn.userAName;
    const peerCompany = isA ? conn.userBCompany : conn.userACompany;
    const peerId = (isA ? conn.userBId : conn.userAId) ?? `peer-${peerName}`;

    await prisma.feedItem.upsert({
      where: { id: `${DERIVED_PREFIX}-followup-${conn.id}` },
      update: {
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
        content: JSON.stringify({
          actor: {
            id: peerId,
            name: peerName,
            company: peerCompany ?? undefined,
          },
          is_read: false,
          connection_id: conn.id,
        }),
        triggerReason: `与 ${peerName} 建立连接已一周，建议跟进一次`,
      },
      create: {
        id: `${DERIVED_PREFIX}-followup-${conn.id}`,
        userId,
        eventId: conn.eventId,
        type: FeedItemType.REMINDER,
        content: JSON.stringify({
          actor: {
            id: peerId,
            name: peerName,
            company: peerCompany ?? undefined,
          },
          is_read: false,
          connection_id: conn.id,
        }),
        triggerReason: `与 ${peerName} 建立连接已一周，建议跟进一次`,
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      },
    });
  }
}
