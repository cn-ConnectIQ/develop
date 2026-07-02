import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { syncLotteryLeadsToMarketup } from "@/lib/lottery/lottery-dashboard-service";

/** 批量导出线索到 MarketUP CRM */
export const POST = withErrorHandler(async (_request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await syncLotteryLeadsToMarketup(lotteryId);
  return createSuccessResponse(result);
});
