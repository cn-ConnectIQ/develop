import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getInteractionScreenPairingStatus,
  requireScreenPairingBindOperator,
  resolveInteractionEventId,
} from "@/lib/screen-pairing/service";

export const GET = withErrorHandler(async (request, context) => {
  const interactionId = context?.params?.interactionId?.trim();
  if (!interactionId) {
    return createErrorResponse("缺少互动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventId = await resolveInteractionEventId(interactionId);
  if (!eventId) {
    throw new ApiError("互动不存在", ErrorCode.NOT_FOUND, 404);
  }

  await requireScreenPairingBindOperator(request, eventId);

  const status = await getInteractionScreenPairingStatus(interactionId);
  return createSuccessResponse(status);
});
