import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { drawBoothInstantLottery } from "@/lib/interaction/lottery-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 展位即时抽奖 */
export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const result = await drawBoothInstantLottery(boothId, userId);
  return createSuccessResponse(result);
});
