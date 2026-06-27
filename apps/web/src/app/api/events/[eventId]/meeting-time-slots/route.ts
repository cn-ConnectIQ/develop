import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getAttendeeMeetingTimeSlots } from "@/lib/mobile-meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** MT2 参会者可选会面时段 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const withUserId = new URL(request.url).searchParams.get("with_user") ?? undefined;
  const slots = await getAttendeeMeetingTimeSlots(eventId, userId, withUserId);
  return createSuccessResponse(slots);
});
