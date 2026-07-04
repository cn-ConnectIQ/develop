import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  revealLotteryTierWinner,
  startLotteryTierDraw,
} from "@/lib/lottery/lottery-screen-service";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";

const drawTierSchema = z.object({
  tier: z.number().int().positive(),
  action: z.enum(["start", "reveal"]),
});

/** 按等级分级开奖（POOL_DRAW 分级模式） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccessMobileOrWeb(request, eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = drawTierSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result =
      parsed.data.action === "start"
        ? await startLotteryTierDraw(eventId, lotteryId, parsed.data.tier)
        : await revealLotteryTierWinner(eventId, lotteryId, parsed.data.tier);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
