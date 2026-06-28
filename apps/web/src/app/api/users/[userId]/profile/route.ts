import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMobilePublicProfile } from "@/lib/mobile-public-profile-service";

/** 参会者公开名片（无需登录） */
export const GET = withErrorHandler(async (_request, context) => {
  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const profile = await getMobilePublicProfile(userId);
    return createSuccessResponse(profile);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
