import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { getAttendeeStampRallyProgress } from "@/lib/stamp/stamp-collect-service";

/** 我的集章进度（自动匹配 ACTIVE 路线，含全部展位格） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const rallyId = new URL(request.url).searchParams.get("rallyId") ?? undefined;
  const userId = await resolveMobileUserId(request);
  const progress = await getAttendeeStampRallyProgress(eventId, userId, rallyId);
  return createSuccessResponse(progress);
});
