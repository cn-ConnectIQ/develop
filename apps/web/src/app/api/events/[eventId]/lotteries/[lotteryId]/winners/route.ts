import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listLotteryWinnersMobile } from "@/lib/interaction/lottery-service";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertAttendeeReadableEvent(eventId);
  const payload = await listLotteryWinnersMobile(eventId, lotteryId);

  return createSuccessResponse(payload);
});
