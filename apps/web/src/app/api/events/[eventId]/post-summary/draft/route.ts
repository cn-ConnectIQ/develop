import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createOrRefreshPostSummaryDraft,
  getPostSummaryDraft,
} from "@/lib/post-summary-draft-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 会后小结草稿：须返回 draft_text */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const draft = await getPostSummaryDraft(eventId, userId);
  return createSuccessResponse(draft);
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const body = await request.json().catch(() => ({}));
  const regenerate = body?.regenerate === true;
  const draft = await createOrRefreshPostSummaryDraft(eventId, userId, {
    regenerate,
  });
  return createSuccessResponse(draft);
});
