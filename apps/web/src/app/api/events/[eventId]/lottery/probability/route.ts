import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { requireLotteryManageAccess } from "@/lib/interaction/lottery-service";
import { createBoothProbabilityLotterySchema } from "@/lib/lottery/booth-probability-lottery-schemas";
import { createOrganizerProbabilityLottery } from "@/lib/lottery/organizer-participant-lottery-service";

/** 管理端 · 主办方概率抽奖（AUTO_PROBABILITY） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  await requireLotteryManageAccess(session, eventId);

  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  const body = await request.json().catch(() => ({}));
  const parsed = createBoothProbabilityLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createOrganizerProbabilityLottery(
    eventId,
    session,
    parsed.data,
  );
  return createSuccessResponse(result);
});
