import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { miniWxLoginWithPhone } from "@/lib/mini-auth-service";

export const POST = withErrorHandler(async (request) => {
  const body = (await request.json()) as { wxCode?: string; phoneCode?: string };
  if (!body.wxCode || !body.phoneCode) {
    return createErrorResponse("缺少 wxCode 或 phoneCode", ErrorCode.BAD_REQUEST, 400);
  }

  try {
    const result = await miniWxLoginWithPhone(body.wxCode, body.phoneCode);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
