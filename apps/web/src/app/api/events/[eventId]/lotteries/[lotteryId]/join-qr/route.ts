import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveLotteryJoinInfo } from "@/lib/interaction/join-info";

/** 抽奖扫码参与入口（公开，含小程序码；参与人抽奖无会话时会补建） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("缺少参数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const join = await resolveLotteryJoinInfo({ eventId, lotteryId });
  return createSuccessResponse({
    scanUrl: join?.scanUrl ?? null,
    qrUrl: join?.qrUrl ?? null,
    wxacodeUrl: join?.wxacodeUrl ?? null,
    sessionCode: join?.sessionCode ?? null,
  });
});
