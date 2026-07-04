import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { replenishLotteryStock } from "@/lib/interaction/lottery-service";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";
import { prisma } from "@connectiq/database";

const bodySchema = z.object({
  add_quantity: z.number().int().positive(),
});

/** 小程序 · 补充参与人抽奖库存 */
export const POST = withErrorHandler(async (request, context) => {
  const lotteryId = context?.params?.id;
  if (!lotteryId) {
    return createErrorResponse("缺少抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: { boothId: true },
  });
  if (!lottery?.boothId) {
    return createErrorResponse("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  const { session } = await requireBoothAccessForRequest(request, lottery.boothId);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await replenishLotteryStock(
    lotteryId,
    parsed.data.add_quantity,
    session,
  );
  return createSuccessResponse(result);
});
