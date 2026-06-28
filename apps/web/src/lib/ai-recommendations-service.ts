import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getCachedMatchReasons } from "@/lib/ai/match-brief-service";
import {
  formatRankedReason,
  recallAndRank,
} from "@/lib/ai/matching";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

/** 主页列表默认返回条数 */
export const DEFAULT_AI_RECOMMENDATIONS_TOP_N = 20;

/** 优先尝试读取 LLM 缓存短原因的人数（仍不触发新生成） */
export const AI_RECOMMENDATIONS_CACHED_REASON_TOP = 5;

export type ApiAiRecommendation = {
  userId: string;
  name: string;
  avatar?: string;
  company?: string;
  title?: string;
  matchScore: number;
  matchReason: string;
};

export type GetAiRecommendationsOptions = {
  topN?: number;
  cachedReasonTop?: number;
};

async function assertEventAccess(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) {
    throw new ApiError("您尚未报名该活动", ErrorCode.FORBIDDEN, 403);
  }
}

/**
 * 活动主页「AI 今日推荐」。
 * - 规则层 recall + rank（零模型成本）
 * - 列表仅用短匹配原因；Top 5 可读已有 MatchBrief 缓存，不触发 LLM
 */
export async function getEventAiRecommendations(
  viewerId: string,
  eventId: string,
  options?: GetAiRecommendationsOptions,
): Promise<ApiAiRecommendation[]> {
  await assertEventAccess(eventId, viewerId);

  const topN = options?.topN ?? DEFAULT_AI_RECOMMENDATIONS_TOP_N;
  const cachedReasonTop =
    options?.cachedReasonTop ?? AI_RECOMMENDATIONS_CACHED_REASON_TOP;

  const { ranked } = await recallAndRank(viewerId, eventId, { topN });
  if (ranked.length === 0) return [];

  const userIds = ranked.map((r) => r.userId);
  const [users, cachedReasonMap] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        profile: {
          select: {
            company: true,
            valueProposition: true,
          },
        },
        contactCard: {
          select: { headline: true },
        },
      },
    }),
    getCachedMatchReasons(
      viewerId,
      eventId,
      ranked.slice(0, cachedReasonTop).map((r) => r.userId),
    ),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));

  const results: ApiAiRecommendation[] = [];

  for (let i = 0; i < ranked.length; i++) {
    const candidate = ranked[i]!;
    const user = userMap.get(candidate.userId);
    if (!user) continue;

    let matchReason = formatRankedReason(candidate);
    if (i < cachedReasonTop) {
      const cached = cachedReasonMap.get(candidate.userId);
      if (cached) {
        matchReason = cached;
      }
    }

    results.push({
      userId: candidate.userId,
      name: user.name,
      avatar: undefined,
      company: user.profile?.company ?? undefined,
      title:
        user.contactCard?.headline ??
        user.profile?.valueProposition ??
        undefined,
      matchScore: candidate.score,
      matchReason,
    });
  }

  return results;
}
