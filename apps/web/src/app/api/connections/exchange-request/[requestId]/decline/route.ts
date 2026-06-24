import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { declineExchangeRequest } from "@/lib/exchange-request-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const POST = withErrorHandler(async (request, context) => {
  const requestId = context?.params?.requestId;
  if (!requestId) {
    return createErrorResponse("缺少请求 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const viewerId = await resolveMobileUserId(request);
  const result = await declineExchangeRequest(viewerId, requestId);
  return createSuccessResponse(result);
});
