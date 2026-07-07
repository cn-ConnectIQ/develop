import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  removeBoothStaffMember,
  requireBoothStaffOwner,
} from "@/lib/exhibitor/booth-staff-service";

/** 移除展位团队成员（仅主账号；不可移除主账号本人） */
export const DELETE = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const participantId = context?.params?.participantId;
  if (!boothId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothStaffOwner(request, boothId);

  try {
    await removeBoothStaffMember(boothId, participantId);
    return createSuccessResponse({ removed: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
