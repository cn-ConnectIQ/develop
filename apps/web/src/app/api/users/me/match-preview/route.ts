import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMatchPreviewForUser } from "@/lib/mobile-ai-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** MT6/会前 意向匹配预览 */
export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return createErrorResponse("缺少 eventId", ErrorCode.VALIDATION_ERROR, 400);
  }

  const items = await getMatchPreviewForUser(userId, eventId);
  return createSuccessResponse(items);
});
