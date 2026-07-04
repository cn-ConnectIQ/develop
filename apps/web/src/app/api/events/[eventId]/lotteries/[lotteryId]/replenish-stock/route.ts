import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  getLotteryOrThrow,
  replenishLotteryStock,
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";

const bodySchema = z.object({
  add_quantity: z.number().int().positive(),
});

/** 管理端 · 补充参与人抽奖库存 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  const lottery = await getLotteryOrThrow(eventId, lotteryId);
  await requireLotteryManageAccess(session, eventId, lottery);

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
