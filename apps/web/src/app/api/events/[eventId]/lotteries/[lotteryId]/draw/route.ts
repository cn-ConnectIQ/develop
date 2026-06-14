import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  drawLotteryWinners,
  getLotteryOrThrow,
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";
import { drawLotterySchema } from "@/lib/interaction/schemas";

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const lottery = await getLotteryOrThrow(eventId, lotteryId);
  await requireLotteryManageAccess(session, eventId, lottery);

  const body = await request.json();
  const parsed = drawLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const winners = await drawLotteryWinners(
    eventId,
    lotteryId,
    parsed.data.prize_rank,
    parsed.data.count,
  );

  return createSuccessResponse(winners, { total: winners.length });
});
