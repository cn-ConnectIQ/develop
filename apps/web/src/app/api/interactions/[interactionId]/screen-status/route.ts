import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";
import { getInteractionScreenPairingStatus } from "@/lib/screen-pairing/service";

export const GET = withErrorHandler(async (request, context) => {
  const interactionId = context?.params?.interactionId;
  if (!interactionId) {
    return createErrorResponse("缺少互动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") ?? undefined;

  if (eventId) {
    await requireEventAccessMobileOrWeb(request, eventId);
  }

  const status = await getInteractionScreenPairingStatus(interactionId);
  return createSuccessResponse(status);
});
