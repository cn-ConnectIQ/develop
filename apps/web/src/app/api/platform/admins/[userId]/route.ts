import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  PlatformAdminError,
  revokePlatformAdmin,
} from "@/lib/platform-admin-service";

export const DELETE = withErrorHandler(async (_request, context) => {
  const auth = await requirePlatformAdmin();
  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const result = await revokePlatformAdmin({
      userId,
      actorUserId: auth.user.id,
    });
    return createSuccessResponse(result);
  } catch (e) {
    if (e instanceof PlatformAdminError) {
      const status =
        e.code === "LAST_ADMIN" || e.code === "FORBIDDEN"
          ? 403
          : e.code === "NOT_FOUND"
            ? 404
            : 400;
      return createErrorResponse(e.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw e;
  }
});
