import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { lookupVerificationCode } from "@/lib/lottery/prize-verification-service";

export const GET = withErrorHandler(async (request, context) => {
  const code = context?.params?.code;
  if (!code) {
    return createErrorResponse("缺少核销码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event_id");
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const result = await lookupVerificationCode(decodeURIComponent(code), eventId);

  if (result.status === "invalid") {
    return createErrorResponse("核销码无效", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(result);
});
