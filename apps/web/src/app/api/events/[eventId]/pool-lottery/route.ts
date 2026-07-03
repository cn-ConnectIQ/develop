import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  enterPoolLotteryMobile,
  getPoolLotteryMobileView,
} from "@/lib/lottery/pool-lottery-mobile-service";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";
import {
  resolveMobileUserId,
  resolveOptionalMobileUserId,
} from "@/lib/mobile-user-id";

/** 参会者 · 闭幕大抽奖（奖池）详情与参与条件 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  await assertAttendeeReadableEvent(eventId);

  const { searchParams } = new URL(request.url);
  const lotteryId = searchParams.get("lotteryId")?.trim() || undefined;
  const userId = await resolveOptionalMobileUserId(request);

  const view = await getPoolLotteryMobileView(eventId, userId, lotteryId);
  if (!view) {
    return createErrorResponse("闭幕大抽奖暂未开放", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(view);
});

/** 参会者 · 加入闭幕大抽奖奖池 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  await assertAttendeeReadableEvent(eventId);

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const lotteryId =
    typeof body?.lottery_id === "string"
      ? body.lottery_id.trim()
      : typeof body?.lotteryId === "string"
        ? body.lotteryId.trim()
        : undefined;

  const view = await enterPoolLotteryMobile(eventId, userId, lotteryId);

  return createSuccessResponse(view);
});
