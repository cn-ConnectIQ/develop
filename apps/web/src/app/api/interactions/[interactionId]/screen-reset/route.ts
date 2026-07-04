import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";
import {
  resetScreenPairingsForInteraction,
  resolveInteractionEventId,
} from "@/lib/screen-pairing/service";

/** 按 interactionId 批量重置所有已配对大屏 */
export const POST = withErrorHandler(async (request, context) => {
  const interactionId = context?.params?.interactionId?.trim();
  if (!interactionId) {
    return createErrorResponse("缺少互动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  let body: { eventId?: string } = {};
  try {
    body = (await request.json()) as { eventId?: string };
  } catch {
    // empty body is ok
  }

  const eventId =
    body.eventId ?? (await resolveInteractionEventId(interactionId));

  if (eventId) {
    await requireEventAccessMobileOrWeb(request, String(eventId));
  }

  const result = await resetScreenPairingsForInteraction(interactionId);
  return createSuccessResponse(result);
});
