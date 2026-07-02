import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  endLotteryScreen,
  revealNextLotteryScreenWinner,
} from "@/lib/lottery/lottery-screen-service";

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  if (body?.end === true) {
    const result = await endLotteryScreen(eventId, lotteryId);
    return createSuccessResponse(result);
  }

  const result = await revealNextLotteryScreenWinner(eventId, lotteryId);
  return createSuccessResponse(result);
});
