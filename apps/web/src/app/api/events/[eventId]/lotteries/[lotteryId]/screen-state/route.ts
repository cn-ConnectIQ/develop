import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getLotteryScreenState } from "@/lib/lottery/lottery-screen-service";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccessMobileOrWeb(request, eventId);
  const state = await getLotteryScreenState(eventId, lotteryId);
  return createSuccessResponse(state);
});
