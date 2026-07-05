import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { requireLotteryManageAccess } from "@/lib/interaction/lottery-service";
import { createBoothLotterySchema } from "@/lib/lottery/booth-lottery-schemas";
import { createOrganizerInstantClaimLottery } from "@/lib/lottery/organizer-participant-lottery-service";

/** 管理端 · 主办方直接领取（INSTANT_CLAIM） */
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
  const parsed = createBoothLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createOrganizerInstantClaimLottery(
    eventId,
    session,
    parsed.data,
  );
  return createSuccessResponse(result);
});
