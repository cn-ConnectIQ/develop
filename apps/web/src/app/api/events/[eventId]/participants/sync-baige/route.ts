import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getBaigeEventSyncStatus,
  syncBaigeParticipants,
} from "@/lib/integrations/baige-sync";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);
  const status = await getBaigeEventSyncStatus(eventId);
  return createSuccessResponse(status);
});

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  try {
    const result = await syncBaigeParticipants(eventId);
    return createSuccessResponse(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "百格同步失败";
    return createErrorResponse(message, ErrorCode.VALIDATION_ERROR, 400);
  }
});
