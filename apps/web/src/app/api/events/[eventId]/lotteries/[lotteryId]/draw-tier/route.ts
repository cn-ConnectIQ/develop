import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  drawLotteryTierWinners,
  startLotteryTierDraw,
  type TierDrawMode,
} from "@/lib/lottery/lottery-screen-service";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";

const drawTierSchema = z.discriminatedUnion("action", [
  z.object({
    tier: z.number().int().positive(),
    action: z.literal("start"),
  }),
  z.object({
    tier: z.number().int().positive(),
    action: z.literal("draw"),
    mode: z.enum(["ONE", "ALL"]),
  }),
  /** 兼容旧控制台：等同 mode=ONE */
  z.object({
    tier: z.number().int().positive(),
    action: z.literal("reveal"),
  }),
]);

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
    if (parsed.data.action === "start") {
      const result = await startLotteryTierDraw(
        eventId,
        lotteryId,
        parsed.data.tier,
      );
      return createSuccessResponse(result);
    }

    const mode: TierDrawMode =
      parsed.data.action === "reveal" ? "ONE" : parsed.data.mode;

    const result = await drawLotteryTierWinners(
      eventId,
      lotteryId,
      parsed.data.tier,
      mode,
    );

    return createSuccessResponse({
      tier: result.tier,
      tier_label: result.tier_label,
      prizeName: result.prizeName,
      quantity: result.quantity,
      thisDrawWinners: result.thisDrawWinners,
      totalDrawnCount: result.totalDrawnCount,
      remainingCount: result.remainingCount,
      tier_complete: result.tier_complete,
      finished: result.finished,
      revealed_total: result.revealed_total,
      winner_quota: result.winner_quota,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
