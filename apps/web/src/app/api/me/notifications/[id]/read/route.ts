import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { markNotificationRead } from "@/lib/mobile-notification-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 单条通知标记已读 */
export const POST = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少通知 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  await markNotificationRead(userId, id);
  return createSuccessResponse({ ok: true });
});
