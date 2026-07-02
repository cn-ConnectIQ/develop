import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listLotteryDashboardWinners } from "@/lib/lottery/lottery-dashboard-service";

export const GET = withErrorHandler(async (_request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const winners = await listLotteryDashboardWinners(lotteryId);
  return createSuccessResponse(winners, { total: winners.length });
});
