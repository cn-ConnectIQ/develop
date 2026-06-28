import {
  AiFeedbackType,
  AiMatchAction,
  ConnectionSource,
  ConnectionStatus,
  ExchangeMethod,
  ExchangeStatus,
  SignalType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getOrCreateContactCard } from "@/lib/contact-card-service";
import { getOrGenerateMatchBrief } from "@/lib/ai/match-brief-service";
import type { MatchDimensionHit } from "@/lib/ai/matching/types";
import { parseIntentTags, type ApiProfileIntentTag } from "@/lib/user-me-service";
import { recordSignal } from "@/lib/signals";
import { MatchFeedbackSignal, trackMatchFeedback } from "@/lib/ai/matching/match-feedback-service";

const CONNECT_CARD_PROFILE_SELECT = {
  company: true,
  valueProposition: true,
  intentTags: true,
} as const;

export type SharedIntentItem = {
  label: string;
  description: string;
};

export type ApiConnectCard = {
  user: {
    id: string;
    name: string;
    avatar_url?: string;
    company?: string;
    title?: string;
    headline?: string;
  };
  aiBrief: string;
  aiMatchScore: number | null;
  matchReason: string | null;
  /** LLM 简报正文（与 aiBrief 相同，B2 契约字段） */
  brief?: string;
  /** 规则+LLM 匹配分（与 aiMatchScore 相同） */
  matchScore?: number | null;
  /** 命中的匹配维度 */
  matchDimensions?: MatchDimensionHit[];
  /** 简报是否来自缓存 */
  briefCached?: boolean;
  sharedIntents: SharedIntentItem[];
  connectionStatus: "NONE" | "PENDING" | "ACTIVE";
  canExchange: boolean;
  hasWechatQr: boolean;
  autoAcceptAtEvent: boolean;
  peerWechatQrUrl?: string;
  peerPhone?: string;
  peerEmail?: string;
  peerWechatId?: string;
};

export type ExchangeCardInfo = {
  user_id: string;
  name: string;
  company?: string;
  title?: string;
  wechat_qr_url?: string;
  wechat_id?: string;
  phone?: string;
  email?: string;
};

export type ExchangePeerContact = {
  id: string;
  name: string;
  company?: string;
  title?: string;
  wechat_qr_url?: string;
  wechat_id?: string;
  phone?: string;
  email?: string;
};

export type ExchangeResult = {
  status: "COMPLETED" | "PENDING";
  connection_id: string;
  connectionId: string;
  peer: ExchangePeerContact;
  my_wechat_qr_url?: string;
  myCard: ExchangeCardInfo;
  theirCard: ExchangeCardInfo;
};

export function buildAiBrief(input: {
  name: string;
  company?: string;
  title?: string;
  headline?: string;
  valueProposition?: string;
  sharedIntents: SharedIntentItem[];
}): string {
  const role = [input.company, input.title].filter(Boolean).join(" · ");
  const intro = input.headline || input.valueProposition;
  const matchHint =
    input.sharedIntents[0]?.description ??
    (input.sharedIntents[0]?.label
      ? `双方在「${input.sharedIntents[0].label}」上存在合作空间`
      : null);

  const parts = [
    `${input.name}${role ? `（${role}）` : ""}`,
    intro ? `：${intro}` : "",
    matchHint
      ? `。${matchHint}，适合作为开场话题。`
      : "。建议先了解对方近期关注点后发起连接。",
  ];
  return parts.join("");
}

export function buildSharedIntents(
  viewerIntents: ApiProfileIntentTag[],
  targetIntents: ApiProfileIntentTag[],
): SharedIntentItem[] {
  const results: SharedIntentItem[] = [];

  for (const demand of viewerIntents.filter((i) => i.type === "DEMAND")) {
    for (const supply of targetIntents.filter((i) => i.type === "SUPPLY")) {
      if (
        demand.label.includes(supply.label.slice(0, 2)) ||
        supply.label.includes(demand.label.slice(0, 2))
      ) {
        results.push({
          label: demand.label,
          description: `你需要 ${demand.label} ↔ 对方提供 ${supply.label}`,
        });
      }
    }
  }

  for (const demand of targetIntents.filter((i) => i.type === "DEMAND")) {
    for (const supply of viewerIntents.filter((i) => i.type === "SUPPLY")) {
      const desc = `对方需要 ${demand.label} ↔ 你提供 ${supply.label}`;
      if (!results.some((r) => r.description === desc)) {
        results.push({ label: demand.label, description: desc });
      }
    }
  }

  if (results.length === 0 && viewerIntents.length > 0 && targetIntents.length > 0) {
    results.push({
      label: "行业交流",
      description: `${viewerIntents[0]?.label ?? "你的诉求"} ↔ ${targetIntents[0]?.label ?? "对方诉求"}`,
    });
  }

  return results.slice(0, 5);
}

export function computeMatchScore(sharedIntents: SharedIntentItem[]): number | null {
  if (sharedIntents.length === 0) return null;
  return Math.min(98, 68 + sharedIntents.length * 10);
}

async function lookupAiMatchResult(
  viewerId: string,
  targetUserId: string,
  eventId?: string,
): Promise<{ score: number | null; reason: string | null; matchId: string | null }> {
  const [viewer, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } }),
  ]);
  if (!viewer || !target) {
    return { score: null, reason: null, matchId: null };
  }

  const match = await prisma.aiMatchResult.findFirst({
    where: {
      ...(eventId ? { eventId } : {}),
      OR: [
        { userAName: viewer.name, userBName: target.name },
        { userAName: target.name, userBName: viewer.name },
      ],
    },
    orderBy: { score: "desc" },
  });

  if (!match) {
    return { score: null, reason: null, matchId: null };
  }

  return { score: match.score, reason: match.reason, matchId: match.id };
}

async function resolveConnectionStatus(
  viewerId: string,
  targetUserId: string,
  eventId?: string,
): Promise<"NONE" | "PENDING" | "ACTIVE"> {
  const active = await prisma.businessConnection.findFirst({
    where: {
      status: ConnectionStatus.ACTIVE,
      wechatExchanged: true,
      OR: [
        { userAId: viewerId, userBId: targetUserId },
        { userAId: targetUserId, userBId: viewerId },
      ],
    },
  });
  if (active) return "ACTIVE";

  const pending = await prisma.exchangeRequest.findFirst({
    where: {
      fromUserId: viewerId,
      toUserId: targetUserId,
      status: ExchangeStatus.PENDING,
      ...(eventId ? { eventId } : {}),
    },
  });
  if (pending) return "PENDING";

  return "NONE";
}

export async function fetchConnectCard(
  viewerId: string,
  targetUserId: string,
  eventId?: string,
): Promise<ApiConnectCard> {
  if (viewerId === targetUserId) {
    throw new ApiError("不能连接自己", ErrorCode.VALIDATION_ERROR, 400);
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      profile: { select: CONNECT_CARD_PROFILE_SELECT },
      contactCard: true,
    },
  });

  if (!target) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  let viewerProfile: { intentTags: unknown } | null = null;
  try {
    viewerProfile = await prisma.userProfile.findUnique({
      where: { userId: viewerId },
      select: { intentTags: true },
    });
  } catch (error) {
    console.warn("[connect-card] viewer profile skipped:", error);
  }

  const viewerIntents = parseIntentTags(viewerProfile?.intentTags);
  const targetIntents = parseIntentTags(target.profile?.intentTags);

  const cardRow =
    target.contactCard ??
    (await prisma.contactCard.findUnique({ where: { userId: targetUserId } }));

  const card = cardRow
    ? {
        wechat_qr_url: cardRow.wechatQrUrl,
        wechat_id: cardRow.wechatId,
        show_phone: cardRow.showPhone,
        show_email: cardRow.showEmail,
        email: cardRow.email,
        allow_exchange: cardRow.allowExchange,
        auto_accept_at_event: cardRow.autoAcceptAtEvent,
        headline: cardRow.headline,
      }
    : await getOrCreateContactCard(targetUserId);

  const sharedIntents = buildSharedIntents(viewerIntents, targetIntents);
  const aiMatch = await lookupAiMatchResult(viewerId, targetUserId, eventId).catch(
    (error) => {
      console.warn("[connect-card] ai match lookup skipped:", error);
      return { score: null, reason: null, matchId: null };
    },
  );
  let aiMatchScore =
    aiMatch.score ?? computeMatchScore(sharedIntents);
  let matchReason: string | null =
    aiMatch.reason ??
    sharedIntents[0]?.description ??
    (aiMatchScore != null ? "基于双方商业意图标签的互补匹配" : null);
  let aiBrief = buildAiBrief({
    name: target.name,
    company: target.profile?.company ?? undefined,
    title: target.profile?.valueProposition ?? undefined,
    headline: card.headline ?? undefined,
    valueProposition: target.profile?.valueProposition ?? undefined,
    sharedIntents,
  });
  let matchDimensions: MatchDimensionHit[] | undefined;
  let briefCached: boolean | undefined;

  if (eventId) {
    try {
      const matchBrief = await getOrGenerateMatchBrief(
        viewerId,
        targetUserId,
        eventId,
      );
      if (matchBrief) {
        aiBrief = matchBrief.brief;
        matchReason = matchBrief.match_reason;
        aiMatchScore = matchBrief.match_score;
        matchDimensions = matchBrief.match_dimensions;
        briefCached = matchBrief.cached;
      }
    } catch (error) {
      console.warn("[connect-card] match brief skipped:", error);
    }
  }

  const connectionStatus = await resolveConnectionStatus(
    viewerId,
    targetUserId,
    eventId,
  ).catch((error) => {
    console.warn("[connect-card] connection status skipped:", error);
    return "NONE" as const;
  });

  const canExchange = card.allow_exchange !== false;
  const hasWechatQr = Boolean(card.wechat_qr_url);

  const result: ApiConnectCard = {
    user: {
      id: target.id,
      name: target.name,
      company: target.profile?.company ?? undefined,
      title: target.profile?.valueProposition ?? undefined,
      headline: card.headline ?? undefined,
    },
    aiBrief,
    aiMatchScore,
    matchReason,
    brief: aiBrief,
    matchScore: aiMatchScore,
    matchDimensions,
    briefCached,
    sharedIntents,
    connectionStatus,
    canExchange,
    hasWechatQr,
    autoAcceptAtEvent: card.auto_accept_at_event === true,
  };

  if (connectionStatus === "ACTIVE" && card.wechat_qr_url) {
    result.peerWechatQrUrl = card.wechat_qr_url;
    if (card.show_phone && target.phone) result.peerPhone = target.phone;
    if (card.show_email && card.email) result.peerEmail = card.email;
    if (card.wechat_id) result.peerWechatId = card.wechat_id;
  }

  if (eventId) {
    trackMatchFeedback({
      viewerId,
      targetId: targetUserId,
      eventId,
      signal: MatchFeedbackSignal.VIEWED,
      matchScore: aiMatchScore ?? undefined,
      matchDimensions,
    });
  }

  return result;
}

async function upsertScanConnection(
  viewerId: string,
  targetUserId: string,
  eventId: string | undefined,
  data: {
    wechatExchanged: boolean;
    exchangeMethod: ExchangeMethod;
    fromAiMatch?: boolean;
    aiMatchScore?: number | null;
    boothId?: string;
    source?: ConnectionSource;
  },
) {
  const existing = await prisma.businessConnection.findFirst({
    where: {
      OR: [
        { userAId: viewerId, userBId: targetUserId },
        { userAId: targetUserId, userBId: viewerId },
      ],
    },
  });

  const [userA, userB, event] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      include: { profile: { select: { company: true } } },
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: { select: { company: true } } },
    }),
    eventId
      ? prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true } })
      : null,
  ]);

  if (!userA || !userB) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const source =
    data.source ??
    (data.fromAiMatch
      ? ConnectionSource.AI_RECOMMEND
      : data.boothId
        ? ConnectionSource.REFERRAL
        : ConnectionSource.SCAN);

  const payload = {
    userAId: viewerId,
    userBId: targetUserId,
    userAName: userA.name,
    userACompany: userA.profile?.company,
    userBName: userB.name,
    userBCompany: userB.profile?.company,
    source,
    originContext:
      source === ConnectionSource.AI_RECOMMEND
        ? "AI 推荐促成"
        : data.boothId
          ? "展位现场连接"
          : "现场扫码交换",
    eventId: event?.id,
    eventName: event?.name,
    status: ConnectionStatus.ACTIVE,
    wechatExchanged: data.wechatExchanged,
    wechatExchangedAt: data.wechatExchanged ? new Date() : null,
    exchangeMethod: data.exchangeMethod,
    fromAiMatch: data.fromAiMatch ?? false,
    aiMatchScore: data.aiMatchScore ?? undefined,
    boothId: data.boothId,
    aiScore: data.aiMatchScore != null ? Math.round(data.aiMatchScore) : undefined,
  };

  if (existing) {
    return prisma.businessConnection.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.businessConnection.create({ data: payload });
}

function mapPeerContact(
  user: {
    id: string;
    name: string;
    phone: string | null;
    profile: { company: string | null; valueProposition: string | null } | null;
    contactCard: {
      wechatQrUrl: string | null;
      wechatId: string | null;
      showPhone: boolean;
      showEmail: boolean;
      email: string | null;
    } | null;
  },
  includePrivate: boolean,
): ExchangePeerContact {
  const card = user.contactCard;
  return {
    id: user.id,
    name: user.name,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
    wechat_qr_url:
      includePrivate && card?.wechatQrUrl ? card.wechatQrUrl : undefined,
    wechat_id: includePrivate && card?.wechatId ? card.wechatId : undefined,
    phone:
      includePrivate && card?.showPhone && user.phone ? user.phone : undefined,
    email:
      includePrivate && card?.showEmail && card.email ? card.email : undefined,
  };
}

function toExchangeCardInfo(contact: ExchangePeerContact): ExchangeCardInfo {
  return {
    user_id: contact.id,
    name: contact.name,
    company: contact.company,
    title: contact.title,
    wechat_qr_url: contact.wechat_qr_url,
    wechat_id: contact.wechat_id,
    phone: contact.phone,
    email: contact.email,
  };
}

export async function buildExchangeResultForConnection(
  viewerId: string,
  peerUserId: string,
  connectionId: string,
): Promise<ExchangeResult> {
  const [viewer, peer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      include: { profile: true, contactCard: true },
    }),
    prisma.user.findUnique({
      where: { id: peerUserId },
      include: { profile: true, contactCard: true },
    }),
  ]);

  if (!viewer || !peer) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const peerContact = mapPeerContact(peer, true);
  const myContact = mapPeerContact(viewer, true);

  return {
    status: "COMPLETED",
    connection_id: connectionId,
    connectionId,
    peer: peerContact,
    my_wechat_qr_url: myContact.wechat_qr_url,
    myCard: toExchangeCardInfo(myContact),
    theirCard: toExchangeCardInfo(peerContact),
  };
}

async function recordPositiveAiMatchFeedback(input: {
  userId: string;
  targetUserId: string;
  eventId?: string;
  aiMatchScore?: number;
  connectionId: string;
}) {
  const [viewer, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: input.targetUserId }, select: { name: true } }),
  ]);
  if (!viewer || !target) return;

  const match = await prisma.aiMatchResult.findFirst({
    where: {
      ...(input.eventId ? { eventId: input.eventId } : {}),
      OR: [
        { userAName: viewer.name, userBName: target.name },
        { userAName: target.name, userBName: viewer.name },
      ],
    },
    orderBy: { score: "desc" },
  });

  await prisma.aiFeedback.create({
    data: {
      userId: input.userId,
      type: AiFeedbackType.MATCH_USEFUL,
      positive: true,
      negativeReason: JSON.stringify({
        reference_table: "AI_MATCH_RESULT",
        reference_id: match?.id ?? input.connectionId,
        target_user_id: input.targetUserId,
        event_id: input.eventId,
        ai_match_score: input.aiMatchScore,
        adopted: true,
      }),
    },
  });

  if (match) {
    await prisma.aiMatchResult.update({
      where: { id: match.id },
      data: {
        connected: true,
        action: AiMatchAction.CONTACTED,
      },
    });
  }
}

async function recordExchangeSignals(input: {
  viewerId: string;
  targetUserId: string;
  eventId?: string;
  boothId?: string;
}) {
  if (!input.eventId) return;

  recordSignal(
    input.viewerId,
    input.eventId,
    SignalType.CONNECTION_MADE,
    input.targetUserId,
    "USER",
  );

  if (input.boothId) {
    recordSignal(
      input.viewerId,
      input.eventId,
      SignalType.CONNECTION_MADE,
      input.boothId,
      "BOOTH",
    );
  }
}

export async function performWechatExchange(input: {
  viewerId: string;
  targetUserId: string;
  eventId?: string;
  boothId?: string;
  method?: ExchangeMethod;
  fromAiMatch?: boolean;
  aiMatchScore?: number;
}): Promise<ExchangeResult> {
  const { viewerId, targetUserId, eventId, boothId } = input;
  const method = input.method ?? ExchangeMethod.FACE_TO_FACE;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { profile: true, contactCard: true },
  });
  if (!target) throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);

  const targetCard =
    target.contactCard ??
    (await prisma.contactCard.findUnique({ where: { userId: targetUserId } }));

  if (!targetCard?.allowExchange) {
    throw new ApiError("对方未开放交换", ErrorCode.FORBIDDEN, 403);
  }

  if (!targetCard.autoAcceptAtEvent && method === ExchangeMethod.FACE_TO_FACE) {
    throw new ApiError(
      "对方未开启现场自动接受，请发起交换请求",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const connection = await upsertScanConnection(viewerId, targetUserId, eventId, {
    wechatExchanged: true,
    exchangeMethod: method,
    fromAiMatch: input.fromAiMatch,
    aiMatchScore: input.aiMatchScore,
    boothId,
  });

  await prisma.exchangeRequest.updateMany({
    where: {
      fromUserId: viewerId,
      toUserId: targetUserId,
      status: ExchangeStatus.PENDING,
      ...(eventId ? { eventId } : {}),
    },
    data: {
      status: ExchangeStatus.ACCEPTED,
      respondedAt: new Date(),
    },
  });

  await recordExchangeSignals({ viewerId, targetUserId, eventId, boothId });

  if (eventId) {
    trackMatchFeedback({
      viewerId,
      targetId: targetUserId,
      eventId,
      signal: MatchFeedbackSignal.EXCHANGED,
      matchScore: input.aiMatchScore ?? undefined,
    });
    trackMatchFeedback({
      viewerId: targetUserId,
      targetId: viewerId,
      eventId,
      signal: MatchFeedbackSignal.EXCHANGED,
      matchScore: input.aiMatchScore ?? undefined,
    });
  }

  if (input.fromAiMatch) {
    await recordPositiveAiMatchFeedback({
      userId: viewerId,
      targetUserId,
      eventId,
      aiMatchScore: input.aiMatchScore,
      connectionId: connection.id,
    });
  }

  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    include: { profile: true, contactCard: true },
  });

  const peer = mapPeerContact({ ...target, contactCard: targetCard }, true);
  const myCard = viewer
    ? mapPeerContact({ ...viewer, contactCard: viewer.contactCard }, true)
    : { id: viewerId, name: "我" };

  return {
    status: "COMPLETED",
    connection_id: connection.id,
    connectionId: connection.id,
    peer,
    my_wechat_qr_url: myCard.wechat_qr_url,
    myCard: toExchangeCardInfo(myCard),
    theirCard: toExchangeCardInfo(peer),
  };
}

export async function createWechatExchangeRequest(input: {
  viewerId: string;
  targetUserId: string;
  eventId?: string;
  boothId?: string;
  message?: string;
  fromAiMatch?: boolean;
  aiMatchScore?: number;
}): Promise<{
  status: "PENDING";
  request_id: string;
  requestId: string;
}> {
  const { viewerId, targetUserId, eventId, boothId, message } = input;

  const [targetCard, fromUser, event] = await Promise.all([
    prisma.contactCard.findUnique({ where: { userId: targetUserId } }),
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { name: true, profile: { select: { company: true } } },
    }),
    eventId
      ? prisma.event.findUnique({ where: { id: eventId }, select: { name: true } })
      : null,
  ]);

  if (targetCard && !targetCard.allowExchange) {
    throw new ApiError("对方未开放交换", ErrorCode.FORBIDDEN, 403);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const existingRequest = await prisma.exchangeRequest.findFirst({
    where: {
      fromUserId: viewerId,
      toUserId: targetUserId,
      eventId: eventId ?? null,
    },
  });

  const request = existingRequest
    ? await prisma.exchangeRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: ExchangeStatus.PENDING,
          message,
          fromAiMatch: input.fromAiMatch ?? false,
          expiresAt,
          respondedAt: null,
          boothId,
        },
      })
    : await prisma.exchangeRequest.create({
        data: {
          fromUserId: viewerId,
          toUserId: targetUserId,
          eventId,
          boothId,
          message,
          fromAiMatch: input.fromAiMatch ?? false,
          expiresAt,
          status: ExchangeStatus.PENDING,
        },
      });

  const fromName = fromUser?.name ?? "参会者";
  const eventLabel = event?.name ? `在 ${event.name}` : "在现场";
  await prisma.notification.create({
    data: {
      userId: targetUserId,
      title: `${fromName} 想和你交换微信`,
      body: `${fromName}${eventLabel}想与你交换微信，点击确认。\n<!--exchange_request:${request.id}-->`,
    },
  });

  return {
    status: "PENDING",
    request_id: request.id,
    requestId: request.id,
  };
}
