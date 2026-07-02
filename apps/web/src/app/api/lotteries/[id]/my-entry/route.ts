import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";
import { getLotteryAttendeeDetail, getLotteryMyEntry } from "@/lib/lottery-attendee-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 参会者 · 我的抽奖参与状态 */
export const GET = withErrorHandler(async (request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const detail = await getLotteryAttendeeDetail(lotteryId, userId);
  await assertAttendeeReadableEvent(detail.event_id);

  const entry = await getLotteryMyEntry(lotteryId, userId);
  return createSuccessResponse(entry);
});
