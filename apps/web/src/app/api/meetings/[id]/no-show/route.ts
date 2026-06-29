import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { markMeetingNoShow } from "@/lib/meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** M5 · 标记对方未出现 */
export const POST = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少会面 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const meeting = await markMeetingNoShow(userId, id);

  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
  });
});
