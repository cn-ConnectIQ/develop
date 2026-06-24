import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchConnectCard } from "@/lib/connect-card-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const GET = withErrorHandler(async (request, context) => {
  const viewerId = await resolveMobileUserId(request);
  const targetUserId = context?.params?.userId;
  if (!targetUserId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") ?? undefined;

  const card = await fetchConnectCard(viewerId, targetUserId, eventId);
  return createSuccessResponse(card);
});
