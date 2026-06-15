import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { countLotteryEligible } from "@/lib/interaction/lottery-service";

/** 预估抽奖符合参与条件的参会者数量 */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const data = await countLotteryEligible(eventId, lotteryId);

  return createSuccessResponse(data);
});
