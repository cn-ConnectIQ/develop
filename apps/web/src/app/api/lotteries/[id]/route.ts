import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";
import { getLotteryAttendeeDetail } from "@/lib/lottery-attendee-service";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";

/** 参会者 · 抽奖详情（奖品 / 展位 / 参与状态） */
export const GET = withErrorHandler(async (request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveOptionalMobileUserId(request);
  const detail = await getLotteryAttendeeDetail(lotteryId, userId);
  await assertAttendeeReadableEvent(detail.event_id);

  return createSuccessResponse(detail);
});
