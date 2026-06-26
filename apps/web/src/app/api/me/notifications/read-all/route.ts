import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { markAllNotificationsRead } from "@/lib/mobile-notification-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 全部标记已读 */
export const POST = withErrorHandler(async (request) => {
  const { userId } = await requireMobileAuth(request);
  const count = await markAllNotificationsRead(userId);
  return createSuccessResponse({ count });
});
