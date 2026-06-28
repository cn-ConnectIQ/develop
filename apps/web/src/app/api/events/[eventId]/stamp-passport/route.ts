import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { getStampPassportForEvent } from "@/lib/stamp-rally-service";

/** 小程序集章护照（自动解析当前 ACTIVE 集章路线） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const passport = await getStampPassportForEvent(eventId, userId);
  return createSuccessResponse(passport);
});
