import {
  ConnectionStatus,
  ExchangeStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { matchPair } from "@/lib/ai/matching/pair-match";
import type { MatchDimensionHit } from "@/lib/ai/matching/types";
import {
  buildAiBrief,
  buildSharedIntents,
  computeMatchScore,
} from "@/lib/connect-card-service";
import { loadIntentTagsForContext, parseIntentTags } from "@/lib/user-me-service";
import { resolveHonorTagsForViewer } from "@/lib/participant-honor-tags-visibility";

export type ApiAiScoreDimensions = {
  industry_fit?: number;
  intent_overlap?: number;
  activity_signal?: number;
};

export type ApiMobilePublicProfile = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
  value_proposition?: string;
  seeks?: string[];
  offers?: string[];
  ai_brief?: string;
  ai_scores?: ApiAiScoreDimensions;
  business_score?: number;
  connection_status?: "NONE" | "PENDING" | "ACTIVE" | "REJECTED";
  pending_direction?: "sent" | "received";
  pending_request_id?: string;
  /** 身份标签（VIP/Speaker 等，按活动配置与查看者权限返回） */
  honor_tags?: string[];
};

export type MobilePublicProfileOptions = {
  viewerId?: string | null;
  eventId?: string | null;
};

function mapAiScores(
  dimensions: MatchDimensionHit[],
  matchScore: number,
): ApiAiScoreDimensions {
  const hasIndustry = dimensions.some((d) => d.dimension === "shared_industry");
  const intentHits = dimensions.filter((d) =>
    ["demand_supply", "supply_demand", "shared_topic", "role_complement"].includes(
      d.dimension,
    ),
  ).length;
  const activityHits = dimensions.filter((d) =>
    ["co_presence", "interaction"].includes(d.dimension),
  ).length;

  const scoreFactor = Math.min(5, matchScore / 20);

  return {
    industry_fit: hasIndustry
      ? Math.min(5, 3 + intentHits * 0.4)
      : Math.min(5, scoreFactor),
    intent_overlap: Math.min(5, 1.5 + intentHits * 0.75),
    activity_signal: Math.min(5, 1 + activityHits * 1.2 + (matchScore >= 70 ? 0.8 : 0)),
  };
}

async function computeBusinessScore(userId: string): Promise<number> {
  const [connections, meetings, intents, profile] = await Promise.all([
    prisma.businessConnection.count({
      where: {
        status: ConnectionStatus.ACTIVE,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    }),
    prisma.meeting.count({
      where: {
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
    }),
    prisma.userEventIntent.count({ where: { userId } }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        company: true,
        valueProposition: true,
        intentTags: true,
      },
    }),
  ]);

  let score = 42;
  score += Math.min(28, connections * 6);
  score += Math.min(15, meetings * 4);
  score += Math.min(10, intents * 5);
  if (profile?.company) score += 3;
  if (profile?.valueProposition) score += 2;
  if (parseIntentTags(profile?.intentTags).length > 0) score += 5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

async function resolveConnectionStatus(
  viewerId: string,
  targetUserId: string,
  eventId?: string | null,
): Promise<{
  status: NonNullable<ApiMobilePublicProfile["connection_status"]>;
  pendingDirection?: "sent" | "received";
  pendingRequestId?: string;
}> {
  const active = await prisma.businessConnection.findFirst({
    where: {
      status: ConnectionStatus.ACTIVE,
      OR: [
        { userAId: viewerId, userBId: targetUserId },
        { userAId: targetUserId, userBId: viewerId },
      ],
    },
  });
  if (active) return { status: "ACTIVE" };

  const outgoingPending = await prisma.exchangeRequest.findFirst({
    where: {
      fromUserId: viewerId,
      toUserId: targetUserId,
      status: ExchangeStatus.PENDING,
      ...(eventId ? { eventId } : {}),
    },
  });
  if (outgoingPending) {
    return {
      status: "PENDING",
      pendingDirection: "sent",
      pendingRequestId: outgoingPending.id,
    };
  }

  const incomingPending = await prisma.exchangeRequest.findFirst({
    where: {
      fromUserId: targetUserId,
      toUserId: viewerId,
      status: ExchangeStatus.PENDING,
      ...(eventId ? { eventId } : {}),
    },
  });
  if (incomingPending) {
    return {
      status: "PENDING",
      pendingDirection: "received",
      pendingRequestId: incomingPending.id,
    };
  }

  return { status: "NONE" };
}

/** 参会者公开名片（无需登录；带 viewer + eventId 时返回 AI3 个性化评估） */
export async function getMobilePublicProfile(
  userId: string,
  options?: MobilePublicProfileOptions,
): Promise<ApiMobilePublicProfile> {
  const viewerId = options?.viewerId ?? null;
  const eventId = options?.eventId ?? null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          company: true,
          industry: true,
          valueProposition: true,
          intentTags: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const tags = eventId
    ? await loadIntentTagsForContext(userId, eventId)
    : parseIntentTags(user.profile?.intentTags);
  const seeks = tags.filter((t) => t.type === "DEMAND").map((t) => t.label);
  const offers = tags.filter((t) => t.type === "SUPPLY").map((t) => t.label);

  const business_score = await computeBusinessScore(userId);

  const base: ApiMobilePublicProfile = {
    id: user.id,
    name: user.name,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
    value_proposition: user.profile?.valueProposition ?? undefined,
    seeks: seeks.length > 0 ? seeks : undefined,
    offers: offers.length > 0 ? offers : undefined,
    business_score,
  };

  if (!viewerId || viewerId === userId) {
    if (seeks.length > 0 || offers.length > 0) {
      base.ai_brief = buildAiBrief({
        name: user.name,
        company: user.profile?.company ?? undefined,
        title: user.profile?.valueProposition ?? undefined,
        valueProposition: user.profile?.valueProposition ?? undefined,
        sharedIntents: [],
      });
    }
    if (eventId) {
      const honorTags = await resolveHonorTagsForViewer(viewerId, userId, eventId);
      if (honorTags?.length) {
        base.honor_tags = honorTags;
      }
    }
    return base;
  }

  const connection = await resolveConnectionStatus(viewerId, userId, eventId)

  base.connection_status = connection.status;
  base.pending_direction = connection.pendingDirection;
  base.pending_request_id = connection.pendingRequestId;

  let sharedIntents = buildSharedIntents([], tags);
  let matchScore = computeMatchScore(sharedIntents) ?? business_score;
  let dimensions: MatchDimensionHit[] = [];

  if (eventId) {
    const pair = await matchPair(viewerId, userId, eventId);
    if (pair) {
      matchScore = pair.score;
      dimensions = pair.dimensions;
    }
    const viewerTags = await loadIntentTagsForContext(viewerId, eventId);
    sharedIntents = buildSharedIntents(viewerTags, tags);
  } else {
    const viewerTags = await loadIntentTagsForContext(viewerId, null);
    sharedIntents = buildSharedIntents(viewerTags, tags);
    matchScore = computeMatchScore(sharedIntents) ?? business_score;
  }

  base.ai_brief = buildAiBrief({
    name: user.name,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
    valueProposition: user.profile?.valueProposition ?? undefined,
    sharedIntents,
  });
  base.ai_scores = mapAiScores(dimensions, matchScore);
  if (matchScore > 0) {
    base.business_score = Math.max(business_score, matchScore);
  }

  if (eventId) {
    const honorTags = await resolveHonorTagsForViewer(viewerId, userId, eventId);
    if (honorTags?.length) {
      base.honor_tags = honorTags;
    }
  }

  return base;
}
