import { prisma, type Prisma } from "@connectiq/database";
import { generateBrief } from "@/lib/ai/brief-generator";
import { matchPair } from "@/lib/ai/matching/pair-match";
import type { MatchDimensionHit } from "@/lib/ai/matching/types";

export type MatchBriefPayload = {
  brief: string;
  match_reason: string;
  match_score: number;
  match_dimensions: MatchDimensionHit[];
  cached: boolean;
  generated_at: string;
};

async function isCacheStale(
  cachedAt: Date,
  targetId: string,
  eventId: string,
): Promise<boolean> {
  const intent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId: targetId, eventId } },
    select: { updatedAt: true },
  });
  if (intent && intent.updatedAt > cachedAt) return true;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: targetId },
    select: { updatedAt: true },
  });
  if (profile && profile.updatedAt > cachedAt) return true;

  return false;
}

function serializeDimensions(raw: unknown): MatchDimensionHit[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is MatchDimensionHit =>
      !!item &&
      typeof item === "object" &&
      typeof (item as MatchDimensionHit).dimension === "string" &&
      typeof (item as MatchDimensionHit).label === "string",
  );
}

/**
 * 获取或生成 A 看 B 的见面简报（带缓存）。
 * 仅对单个目标调用，控 LLM 成本。
 */
export async function getOrGenerateMatchBrief(
  viewerId: string,
  targetId: string,
  eventId: string,
): Promise<MatchBriefPayload | null> {
  try {
    const cached = await prisma.matchBrief.findUnique({
      where: {
        viewerId_targetId_eventId: { viewerId, targetId, eventId },
      },
    });

    if (cached) {
      const stale = await isCacheStale(cached.generatedAt, targetId, eventId);
      if (!stale) {
        return {
          brief: cached.brief,
          match_reason: cached.matchReason,
          match_score: cached.matchScore,
          match_dimensions: serializeDimensions(cached.matchDimensions),
          cached: true,
          generated_at: cached.generatedAt.toISOString(),
        };
      }
    }

    const pair = await matchPair(viewerId, targetId, eventId);
    if (!pair) return null;

    const [event, viewerUser, targetUser] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: { name: true },
      }),
      loadProfileForBrief(viewerId, eventId),
      loadProfileForBrief(targetId, eventId),
    ]);

    if (!viewerUser || !targetUser) return null;

    const generated = await generateBrief({
      viewerProfile: viewerUser,
      targetProfile: targetUser,
      matchDimensions: pair.dimensions,
      matchScore: pair.score,
      eventName: event?.name,
    });

    const dimensionsJson = pair.dimensions as unknown as Prisma.InputJsonValue;

    const row = await prisma.matchBrief.upsert({
      where: {
        viewerId_targetId_eventId: { viewerId, targetId, eventId },
      },
      create: {
        viewerId,
        targetId,
        eventId,
        brief: generated.brief,
        matchReason: generated.match_reason,
        matchScore: pair.score,
        matchDimensions: dimensionsJson,
      },
      update: {
        brief: generated.brief,
        matchReason: generated.match_reason,
        matchScore: pair.score,
        matchDimensions: dimensionsJson,
        generatedAt: new Date(),
      },
    });

    return {
      brief: row.brief,
      match_reason: row.matchReason,
      match_score: row.matchScore,
      match_dimensions: pair.dimensions,
      cached: false,
      generated_at: row.generatedAt.toISOString(),
    };
  } catch (error) {
    console.warn("[match-brief] generation failed:", error);
    return null;
  }
}

async function loadProfileForBrief(userId: string, eventId: string) {
  const [user, intent, card] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        profile: {
          select: {
            company: true,
            valueProposition: true,
            industry: true,
          },
        },
      },
    }),
    prisma.userEventIntent.findUnique({
      where: { userId_eventId: { userId, eventId } },
    }),
    prisma.contactCard.findUnique({
      where: { userId },
      select: { headline: true },
    }),
  ]);

  if (!user) return null;

  return {
    name: user.name,
    company: user.profile?.company ?? null,
    title: user.profile?.valueProposition ?? null,
    role: intent?.role ?? null,
    industry: intent?.industry ?? user.profile?.industry ?? null,
    region: intent?.region ?? null,
    supplyTags: intent?.supplyTags ?? [],
    demandTags: intent?.demandTags ?? [],
    topics: intent?.topics ?? [],
    headline: card?.headline ?? null,
  };
}

/** 目标用户资料变更时主动失效缓存 */
export async function invalidateMatchBriefsForTarget(
  targetId: string,
  eventId?: string,
) {
  await prisma.matchBrief.deleteMany({
    where: {
      targetId,
      ...(eventId ? { eventId } : {}),
    },
  });
}

/**
 * 仅读取已缓存的短匹配原因（不触发 LLM 完整简报）。
 * 用于主页推荐列表 Top N 展示。
 */
export async function getCachedMatchReason(
  viewerId: string,
  targetId: string,
  eventId: string,
): Promise<string | null> {
  const map = await getCachedMatchReasons(viewerId, eventId, [targetId]);
  return map.get(targetId) ?? null;
}

/**
 * 批量读取已缓存的短匹配原因（不触发 LLM）。
 * 用于主页推荐列表 Top N 展示。
 */
export async function getCachedMatchReasons(
  viewerId: string,
  eventId: string,
  targetIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (targetIds.length === 0) return result;

  const rows = await prisma.matchBrief.findMany({
    where: {
      viewerId,
      eventId,
      targetId: { in: targetIds },
    },
    select: {
      targetId: true,
      matchReason: true,
      generatedAt: true,
    },
  });
  if (rows.length === 0) return result;

  const [intents, profiles] = await Promise.all([
    prisma.userEventIntent.findMany({
      where: { eventId, userId: { in: targetIds } },
      select: { userId: true, updatedAt: true },
    }),
    prisma.userProfile.findMany({
      where: { userId: { in: targetIds } },
      select: { userId: true, updatedAt: true },
    }),
  ]);

  const intentUpdatedAt = new Map(intents.map((i) => [i.userId, i.updatedAt]));
  const profileUpdatedAt = new Map(profiles.map((p) => [p.userId, p.updatedAt]));

  for (const row of rows) {
    const intentAt = intentUpdatedAt.get(row.targetId);
    if (intentAt && intentAt > row.generatedAt) continue;
    const profileAt = profileUpdatedAt.get(row.targetId);
    if (profileAt && profileAt > row.generatedAt) continue;
    result.set(row.targetId, row.matchReason);
  }

  return result;
}
