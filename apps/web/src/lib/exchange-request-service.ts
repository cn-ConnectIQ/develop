import {
  ConnectionStatus,
  ExchangeMethod,
  ExchangeStatus,
  SignalType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  buildAiBrief,
  buildExchangeResultForConnection,
  buildSharedIntents,
  computeMatchScore,
  fetchConnectCard,
  performWechatExchange,
  type ExchangeResult,
} from "@/lib/connect-card-service";
import { parseIntentTags } from "@/lib/user-me-service";
import { recordSignal } from "@/lib/signals";
import {
  MatchFeedbackSignal,
  trackMatchFeedback,
} from "@/lib/ai/matching/match-feedback-service";

export type ApiExchangeRequestUser = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
};

export type ApiExchangeRequestItem = {
  id: string;
  status: ExchangeStatus;
  message?: string;
  from_ai_match: boolean;
  direction: "sent" | "received";
  created_at: string;
  responded_at?: string;
  from_user: ApiExchangeRequestUser;
  to_user: ApiExchangeRequestUser;
  event?: { id: string; name: string };
  exchange_result?: ExchangeResult;
};

export type ApiExchangeRequestDetail = ApiExchangeRequestItem & {
  ai_brief?: string;
  ai_match_score?: number | null;
  match_reason?: string | null;
};

function mapRequestUser(user: {
  id: string;
  name: string;
  profile: { company: string | null; valueProposition: string | null } | null;
}): ApiExchangeRequestUser {
  return {
    id: user.id,
    name: user.name,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
  };
}

async function buildExchangeResultForUsers(
  viewerId: string,
  peerUserId: string,
  connectionId: string,
): Promise<ExchangeResult> {
  return buildExchangeResultForConnection(viewerId, peerUserId, connectionId);
}

function mapRequestRow(
  row: {
    id: string;
    status: ExchangeStatus;
    message: string | null;
    fromAiMatch: boolean;
    fromUserId: string;
    toUserId: string;
    createdAt: Date;
    respondedAt: Date | null;
    fromUser: {
      id: string;
      name: string;
      profile: { company: string | null; valueProposition: string | null } | null;
    };
    toUser: {
      id: string;
      name: string;
      profile: { company: string | null; valueProposition: string | null } | null;
    };
    event: { id: string; name: string } | null;
  },
  viewerId: string,
  exchangeResult?: ExchangeResult,
): ApiExchangeRequestItem {
  return {
    id: row.id,
    status: row.status,
    message: row.message ?? undefined,
    from_ai_match: row.fromAiMatch,
    direction: row.toUserId === viewerId ? "received" : "sent",
    created_at: row.createdAt.toISOString(),
    responded_at: row.respondedAt?.toISOString(),
    from_user: mapRequestUser(row.fromUser),
    to_user: mapRequestUser(row.toUser),
    event: row.event ? { id: row.event.id, name: row.event.name } : undefined,
    exchange_result: exchangeResult,
  };
}

export async function listMyExchangeRequests(
  viewerId: string,
  options: {
    status?: ExchangeStatus;
    direction?: "sent" | "received";
  },
): Promise<ApiExchangeRequestItem[]> {
  const direction = options.direction ?? "received";
  const where =
    direction === "sent"
      ? { fromUserId: viewerId, ...(options.status ? { status: options.status } : {}) }
      : { toUserId: viewerId, ...(options.status ? { status: options.status } : {}) };

  const rows = await prisma.exchangeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      fromUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true, valueProposition: true } },
        },
      },
      toUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true, valueProposition: true } },
        },
      },
      event: { select: { id: true, name: true } },
    },
  });

  const results: ApiExchangeRequestItem[] = [];

  for (const row of rows) {
    let exchangeResult: ExchangeResult | undefined;
    if (
      row.status === ExchangeStatus.ACCEPTED &&
      direction === "sent" &&
      row.fromUserId === viewerId
    ) {
      const connection = await prisma.businessConnection.findFirst({
        where: {
          status: ConnectionStatus.ACTIVE,
          wechatExchanged: true,
          OR: [
            { userAId: viewerId, userBId: row.toUserId },
            { userAId: row.toUserId, userBId: viewerId },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      if (connection) {
        exchangeResult = await buildExchangeResultForUsers(
          viewerId,
          row.toUserId,
          connection.id,
        );
      }
    }

    results.push(mapRequestRow(row, viewerId, exchangeResult));
  }

  return results;
}

export async function getExchangeRequestDetail(
  viewerId: string,
  requestId: string,
): Promise<ApiExchangeRequestDetail> {
  const row = await prisma.exchangeRequest.findUnique({
    where: { id: requestId },
    include: {
      fromUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true, valueProposition: true } },
        },
      },
      toUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true, valueProposition: true } },
        },
      },
      event: { select: { id: true, name: true } },
    },
  });

  if (!row || (row.fromUserId !== viewerId && row.toUserId !== viewerId)) {
    throw new ApiError("请求不存在", ErrorCode.NOT_FOUND, 404);
  }

  let exchangeResult: ExchangeResult | undefined;
  if (row.status === ExchangeStatus.ACCEPTED) {
    const peerId = row.fromUserId === viewerId ? row.toUserId : row.fromUserId;
    const connection = await prisma.businessConnection.findFirst({
      where: {
        status: ConnectionStatus.ACTIVE,
        wechatExchanged: true,
        OR: [
          { userAId: viewerId, userBId: peerId },
          { userAId: peerId, userBId: viewerId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (connection) {
      exchangeResult = await buildExchangeResultForUsers(
        viewerId,
        peerId,
        connection.id,
      );
    }
  }

  const base = mapRequestRow(row, viewerId, exchangeResult);

  const isReceiver = row.toUserId === viewerId;
  let aiBrief: string | undefined;
  let aiMatchScore: number | null | undefined;
  let matchReason: string | null | undefined;

  if (isReceiver && row.status === ExchangeStatus.PENDING) {
    const card = await fetchConnectCard(viewerId, row.fromUserId, row.eventId ?? undefined);
    aiBrief = card.aiBrief;
    aiMatchScore = card.aiMatchScore;
    matchReason = card.matchReason;
  } else if (row.fromAiMatch) {
    const [viewer, fromUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: viewerId },
        include: { profile: { select: { intentTags: true, company: true } } },
      }),
      prisma.user.findUnique({
        where: { id: row.fromUserId },
        include: {
          profile: { select: { intentTags: true, company: true, valueProposition: true } },
          contactCard: { select: { headline: true } },
        },
      }),
    ]);
    if (viewer && fromUser) {
      const viewerIntents = parseIntentTags(viewer.profile?.intentTags);
      const fromIntents = parseIntentTags(fromUser.profile?.intentTags);
      const sharedIntents = buildSharedIntents(viewerIntents, fromIntents);
      aiMatchScore = computeMatchScore(sharedIntents);
      matchReason =
        sharedIntents[0]?.description ??
        (aiMatchScore != null ? "基于双方商业意图标签的互补匹配" : null);
      aiBrief = buildAiBrief({
        name: fromUser.name,
        company: fromUser.profile?.company ?? undefined,
        title: fromUser.profile?.valueProposition ?? undefined,
        headline: fromUser.contactCard?.headline ?? undefined,
        valueProposition: fromUser.profile?.valueProposition ?? undefined,
        sharedIntents,
      });
    }
  }

  return {
    ...base,
    ai_brief: aiBrief,
    ai_match_score: aiMatchScore,
    match_reason: matchReason,
  };
}

async function notifyExchangeAccepted(
  fromUserId: string,
  accepterName: string,
  eventName?: string,
  requestId?: string,
) {
  const { sendExchangeResultSubscribe } = await import("@/lib/wechat/subscribe-message");
  void sendExchangeResultSubscribe({
    toUserId: fromUserId,
    accepterName,
    eventName,
    requestId,
  });
}

async function notifyExchangeDeclined(fromUserId: string) {
  void fromUserId;
}

async function notifyIncomingExchangeRequest(
  toUserId: string,
  fromName: string,
  eventName?: string,
  requestId?: string,
) {
  const { sendExchangeRequestSubscribe } = await import("@/lib/wechat/subscribe-message");
  void sendExchangeRequestSubscribe({
    toUserId,
    fromName,
    eventName,
    requestId,
  });
}

export async function acceptExchangeRequest(
  accepterId: string,
  requestId: string,
): Promise<ExchangeResult> {
  const request = await prisma.exchangeRequest.findUnique({
    where: { id: requestId },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { name: true } },
      event: { select: { name: true } },
    },
  });

  if (!request || request.toUserId !== accepterId) {
    throw new ApiError("请求不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (request.status !== ExchangeStatus.PENDING) {
    throw new ApiError("请求已处理", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await performWechatExchange({
    viewerId: accepterId,
    targetUserId: request.fromUserId,
    eventId: request.eventId ?? undefined,
    boothId: request.boothId ?? undefined,
    method: ExchangeMethod.DEFERRED,
    fromAiMatch: request.fromAiMatch,
  });

  await prisma.exchangeRequest.update({
    where: { id: requestId },
    data: {
      status: ExchangeStatus.ACCEPTED,
      respondedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: request.fromUserId,
      title: `${request.toUser.name} 已同意交换微信`,
      body: `${request.toUser.name}已同意与你交换微信，点击查看对方二维码。\n<!--exchange_accepted:${request.id}-->`,
    },
  });

  if (request.eventId) {
    recordSignal(
      accepterId,
      request.eventId,
      SignalType.CONNECTION_MADE,
      request.fromUserId,
      "USER",
    );
  }

  await notifyExchangeAccepted(
    request.fromUserId,
    request.toUser.name,
    request.event?.name,
    requestId,
  );

  return result;
}

export async function declineExchangeRequest(
  accepterId: string,
  requestId: string,
): Promise<{ status: "DECLINED" }> {
  const request = await prisma.exchangeRequest.findUnique({
    where: { id: requestId },
    include: {
      toUser: { select: { name: true } },
    },
  });

  if (!request || request.toUserId !== accepterId) {
    throw new ApiError("请求不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (request.status !== ExchangeStatus.PENDING) {
    throw new ApiError("请求已处理", ErrorCode.VALIDATION_ERROR, 400);
  }

  await prisma.exchangeRequest.update({
    where: { id: requestId },
    data: {
      status: ExchangeStatus.DECLINED,
      respondedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: request.fromUserId,
      title: "交换请求暂未通过",
      body: `${request.toUser.name}暂未同意交换微信，你可以稍后再试或现场扫码连接。`,
    },
  });

  await notifyExchangeDeclined(request.fromUserId);

  if (request.eventId) {
    trackMatchFeedback({
      viewerId: request.fromUserId,
      targetId: request.toUserId,
      eventId: request.eventId,
      signal: MatchFeedbackSignal.DECLINED,
    });
  }

  return { status: "DECLINED" };
}

export { notifyIncomingExchangeRequest };
