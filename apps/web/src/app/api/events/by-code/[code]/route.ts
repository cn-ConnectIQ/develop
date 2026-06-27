import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { findEventByJoinCode } from "@/lib/event-join-code-service";

/** Z1 按活动码查询活动（GET fallback） */
export const GET = withErrorHandler(async (_request, context) => {
  const code = context?.params?.code;
  if (!code) {
    return createErrorResponse("缺少活动码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await findEventByJoinCode(decodeURIComponent(code));
  if (!event) {
    return createErrorResponse("活动码无效或活动未开放", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(event);
});
