import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { claimStampPassportReward } from "@/lib/stamp-rally-service";

/** 小程序集章路线兑奖（可 ?rallyId=） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const rallyId =
    searchParams.get("rallyId") ??
    (typeof body?.rallyId === "string"
      ? body.rallyId
      : typeof body?.rally_id === "string"
        ? body.rally_id
        : null);

  const passport = await claimStampPassportReward(eventId, userId, rallyId);
  return createSuccessResponse(passport);
});
