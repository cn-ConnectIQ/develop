import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getExchangeRequestDetail } from "@/lib/exchange-request-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const GET = withErrorHandler(async (request, context) => {
  const requestId = context?.params?.requestId;
  if (!requestId) {
    return createErrorResponse("缺少请求 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const viewerId = await resolveMobileUserId(request);
  const detail = await getExchangeRequestDetail(viewerId, requestId);
  return createSuccessResponse(detail);
});
