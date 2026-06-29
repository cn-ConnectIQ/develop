import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMobilePublicProfile } from "@/lib/mobile-public-profile-service";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";

/** 参会者公开名片（无需登录；登录 + eventId 时含 AI3 评估） */
export const GET = withErrorHandler(async (request, context) => {
  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const viewerId = await resolveOptionalMobileUserId(request);

  try {
    const profile = await getMobilePublicProfile(userId, {
      viewerId,
      eventId,
    });
    return createSuccessResponse(profile);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
