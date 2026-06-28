import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { getEventDiscover } from "@/lib/event-discover-service";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";

/** 小程序发现活动（最近参加 + 附近推荐；未登录仅返回 nearby） */
export const GET = withErrorHandler(async (request) => {
  const userId = await resolveOptionalMobileUserId(request);
  const data = await getEventDiscover(userId);
  return createSuccessResponse(data);
});
