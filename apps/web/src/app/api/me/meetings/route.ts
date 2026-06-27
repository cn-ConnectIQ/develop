import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { listMyMeetings } from "@/lib/mobile-meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** MT5 我的会面列表 */
export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") ?? undefined;
  const meetings = await listMyMeetings(userId, eventId);
  return createSuccessResponse({ meetings });
});
