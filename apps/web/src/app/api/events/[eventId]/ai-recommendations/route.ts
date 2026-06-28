import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventAiRecommendations } from "@/lib/ai-recommendations-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 活动主页 — AI 今日推荐（规则召回+打分，列表仅短原因） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await getEventAiRecommendations(userId, eventId);
  return createSuccessResponse(data);
});
