import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { enterLottery, getLotteryOrThrow } from "@/lib/interaction/lottery-service";

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { user } = await requireAuth(request);
  await getLotteryOrThrow(eventId, lotteryId);

  const entry = await enterLottery(eventId, lotteryId, user.id);

  return createSuccessResponse(entry);
});
