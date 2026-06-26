import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { listMobileNotifications } from "@/lib/mobile-notification-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 移动端通知中心 */
export const GET = withErrorHandler(async (request) => {
  const { userId } = await requireMobileAuth(request);
  const data = await listMobileNotifications(userId);
  return createSuccessResponse(data);
});
