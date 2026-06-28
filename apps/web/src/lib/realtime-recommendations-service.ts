import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  getRealtimeRecommendations,
  type GetRealtimeRecommendationsOptions,
  type RealtimeRecommendationsResult,
} from "@/lib/ai/matching/realtime-recommend";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

export type ApiRealtimeRecommendations = RealtimeRecommendationsResult;

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
 * 现场行为驱动的实时推荐 API 层。
 * 客户端在投票/扫码/问答后轮询此接口即可获取更新推荐。
 */
export async function getEventRealtimeRecommendations(
  viewerId: string,
  eventId: string,
  options?: GetRealtimeRecommendationsOptions,
): Promise<ApiRealtimeRecommendations> {
  await assertEventAccess(eventId, viewerId);
  return getRealtimeRecommendations(viewerId, eventId, options);
}
