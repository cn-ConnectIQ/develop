import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { createBoothLotterySchema } from "@/lib/lottery/booth-lottery-schemas";
import { createFillGetGiftQuickLaunch } from "@/lib/lottery/quick-launch-service";
import { prisma } from "@connectiq/database";

/** 管理端 · QUICK-03B 直接领取（INSTANT_CLAIM） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: { id: true },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createBoothLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createFillGetGiftQuickLaunch(
    boothId,
    session,
    parsed.data,
  );
  return createSuccessResponse(result);
});
