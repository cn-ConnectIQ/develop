import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { drawBoothLottery } from "@/lib/exhibitor/booth-interaction-service";
import { drawLotterySchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const sessionId = context?.params?.id;
  if (!boothId || !sessionId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { booth } = await requireBoothAccessForRequest(request, boothId);
  const disabled = await guardEventFeature(booth.eventId, "lottery");
  if (disabled) return disabled;

  const body = await request.json();
  const parsed = drawLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await drawBoothLottery(
    boothId,
    sessionId,
    parsed.data.prize_rank,
    parsed.data.count,
  );

  return createSuccessResponse(result);
});
