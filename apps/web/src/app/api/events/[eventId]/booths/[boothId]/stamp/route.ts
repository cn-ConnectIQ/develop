import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { stampAtEventBooth } from "@/lib/stamp-rally-service";

/** 小程序展位集章打卡（无需 rallyId，自动匹配路线） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const passport = await stampAtEventBooth(eventId, userId, boothId);
  return createSuccessResponse(passport);
});
