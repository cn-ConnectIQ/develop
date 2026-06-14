import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";
import { getPublicSessionPayload } from "@/lib/interaction/session-service";

/** 公开：扫码落地页数据 */
export const GET = withErrorHandler(async (_request, context) => {
  const sessionCode = context?.params?.sessionCode;
  if (!sessionCode) {
    return createErrorResponse("缺少会话码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const payload = await getPublicSessionPayload(sessionCode);
  return createSuccessResponse(payload);
});
