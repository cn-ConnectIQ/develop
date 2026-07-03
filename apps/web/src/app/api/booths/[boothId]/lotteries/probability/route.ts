import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { createBoothProbabilityLotterySchema } from "@/lib/lottery/booth-probability-lottery-schemas";
import { createBoothProbabilityLottery } from "@/lib/lottery/booth-probability-lottery-service";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

/** 创建类型② 行为触发概率抽奖 */
export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireBoothAccessForRequest(request, boothId);
  const body = await request.json().catch(() => ({}));
  const parsed = createBoothProbabilityLotterySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createBoothProbabilityLottery(
    boothId,
    session,
    parsed.data,
  );

  return createSuccessResponse(result);
});
