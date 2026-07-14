import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { claimStampPassportReward } from "@/lib/stamp-rally-service";

/** 小程序集章兑奖（别名：/stamp-passport/claim-reward） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const rallyId =
    typeof body?.rallyId === "string"
      ? body.rallyId
      : typeof body?.rally_id === "string"
        ? body.rally_id
        : new URL(request.url).searchParams.get("rallyId");

  const passport = await claimStampPassportReward(eventId, userId, rallyId);
  return createSuccessResponse(passport);
});
