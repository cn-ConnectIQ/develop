import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";
import { getEventSnStatus } from "@/lib/sn-status-service";


export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  const userId = await resolveOptionalMobileUserId(request);
  const status = await getEventSnStatus(eventId, userId);
  return createSuccessResponse(status);
});
