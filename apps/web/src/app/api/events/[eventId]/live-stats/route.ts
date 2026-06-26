import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventLiveStats } from "@/lib/live-stats-service";

/**
 * 实时概览轮询接口（Realtime 不可用时的降级，建议 15s 间隔）
 */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const data = await getEventLiveStats(eventId);
  return createSuccessResponse(data);
});
