import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { generateBoothRoute } from "@/lib/ai/booth-route-service";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";


export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const enabled = await isEventFeatureEnabled(eventId, "aiBoothRoute");
  if (!enabled) {
    return createErrorResponse("AI 展位路线未开启", ErrorCode.FORBIDDEN, 403);
  }

  const userId = await resolveMobileUserId(request);
  const result = await generateBoothRoute(userId, eventId);

  return createSuccessResponse(result);
});
