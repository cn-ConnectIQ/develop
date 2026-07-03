import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { executeProbabilityLotteryDraw } from "@/lib/lottery/booth-probability-lottery-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 参会者触发概率抽奖（校验触发条件 → 概率引擎 → 统一核销码） */
export const POST = withErrorHandler(async (request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: { eventId: true },
  });

  if (!lottery) {
    return createErrorResponse("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  const disabled = await guardEventFeature(lottery.eventId, "lottery");
  if (disabled) return disabled;

  try {
    const result = await executeProbabilityLotteryDraw(lotteryId, userId);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
