import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { createBoothLotterySchema } from "@/lib/lottery/booth-lottery-schemas";
import { createQuickLaunch } from "@/lib/lottery/quick-launch-service";
import { QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT } from "@/lib/lottery/quick-launch-templates";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";
import { prisma } from "@connectiq/database";

const createQuickLaunchSchema = createBoothLotterySchema.extend({
  booth_id: z.string().cuid(),
  template: z.literal(QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT),
});

/** 展商 · 快速发起互动（fill_get_gift / QUICK-03B） */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = createQuickLaunchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { session } = await requireBoothAccessForRequest(
    request,
    parsed.data.booth_id,
  );

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: parsed.data.booth_id },
    select: { eventId: true },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const disabled = await guardEventFeature(booth.eventId, "lottery");
  if (disabled) return disabled;

  const { booth_id, template, ...lotteryInput } = parsed.data;
  const result = await createQuickLaunch(booth_id, session, template, lotteryInput);

  return createSuccessResponse(result);
});
