import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getConnectionNoteSuggestion } from "@/lib/mobile-ai-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 连接请求 AI 附言建议 */
export const GET = withErrorHandler(async (request) => {
  const viewerId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const targetId =
    searchParams.get("targetId") ?? searchParams.get("target_user_id");
  if (!targetId) {
    return createErrorResponse("缺少 targetId", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventId = searchParams.get("eventId") ?? undefined;
  const refresh = searchParams.get("refresh") === "1";

  const result = await getConnectionNoteSuggestion(viewerId, targetId, {
    eventId,
    refresh,
  });
  return createSuccessResponse(result);
});
