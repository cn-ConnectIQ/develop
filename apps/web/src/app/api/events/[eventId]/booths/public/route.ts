import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listPublicEventBooths } from "@/lib/mobile-booth-service";

/** 找展位（参会者公开列表，无需登录） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const data = await listPublicEventBooths(eventId);
  return createSuccessResponse(data);
});
