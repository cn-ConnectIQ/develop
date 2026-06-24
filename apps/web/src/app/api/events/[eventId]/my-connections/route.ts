import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listEventMyConnections } from "@/lib/event-my-connections-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const viewerId = await resolveMobileUserId(request);
  const data = await listEventMyConnections(viewerId, eventId);
  return createSuccessResponse(data);
});
