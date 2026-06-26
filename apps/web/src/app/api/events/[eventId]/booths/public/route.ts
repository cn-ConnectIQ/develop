import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listPublicEventBooths } from "@/lib/mobile-booth-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 找展位（参会者公开列表） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireMobileAuth(request);
  const data = await listPublicEventBooths(eventId);
  return createSuccessResponse(data);
});
