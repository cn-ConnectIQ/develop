import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getScanBrief } from "@/lib/mobile-ai-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 扫码 AI 简报 */
export const GET = withErrorHandler(async (request) => {
  const viewerId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const targetUserId =
    searchParams.get("targetUserId") ?? searchParams.get("target_user_id");
  if (!targetUserId) {
    return createErrorResponse("缺少 targetUserId", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventId = searchParams.get("eventId") ?? undefined;
  const brief = await getScanBrief(viewerId, targetUserId, eventId);
  return createSuccessResponse(brief);
});
