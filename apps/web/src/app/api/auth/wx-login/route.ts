import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { miniWxLogin } from "@/lib/mini-auth-service";

export const POST = withErrorHandler(async (request) => {
  const body = (await request.json()) as { code?: string };
  if (!body.code) {
    return createErrorResponse("缺少 code", ErrorCode.BAD_REQUEST, 400);
  }

  try {
    const result = await miniWxLogin(body.code);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
