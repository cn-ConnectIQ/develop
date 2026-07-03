import { LotteryCategory, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  claimInstantLotteryGift,
  type BoothLotteryLeadInput,
} from "@/lib/interaction/lottery-service";
import { loadQuickLaunchContext } from "@/lib/lottery/quick-launch-service";
import {
  isFillGetGiftTemplate,
  QUICK_LAUNCH_CODE_03B,
  QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
} from "@/lib/lottery/quick-launch-templates";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const enterSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  company: z.string().max(120).optional(),
  title: z.string().max(80).optional(),
  form_data: z.record(z.string()).optional(),
});

/** 参会者 · 快速发起参与（fill_get_gift / QUICK-03B · 类型③ INSTANT_CLAIM） */
export const POST = withErrorHandler(async (request, context) => {
  const launchId = context?.params?.id;
  if (!launchId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = enterSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const ctx = await loadQuickLaunchContext(launchId);

  const disabled = await guardEventFeature(ctx.eventId, "lottery");
  if (disabled) return disabled;

  if (!isFillGetGiftTemplate(ctx.template)) {
    return createErrorResponse(
      "不支持的快速发起模板",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: ctx.lotteryId },
    select: { lotteryCategory: true },
  });
  if (!lottery || lottery.lotteryCategory !== LotteryCategory.INSTANT_CLAIM) {
    return createErrorResponse(
      "该快速发起未配置为直接领取类型（INSTANT_CLAIM）",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const lead: BoothLotteryLeadInput = {
    name: parsed.data.name,
    phone: parsed.data.phone,
    company: parsed.data.company,
    title: parsed.data.title,
  };
  if (parsed.data.form_data) {
    Object.assign(lead, parsed.data.form_data);
  }

  // 填表必得：创建中奖记录并在 claimInstantLotteryGift 内 attachToRedemptionCode
  const claim = await claimInstantLotteryGift(ctx.lotteryId, userId, lead);

  return createSuccessResponse({
    template: QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
    template_code: QUICK_LAUNCH_CODE_03B,
    lottery_id: claim.lottery_id,
    lottery_category: LotteryCategory.INSTANT_CLAIM,
    has_entered: true,
    won: claim.won,
    prize_tier:
      claim.prize_tier != null ? `${claim.prize_tier}等奖` : undefined,
    prize_name: claim.prize_name ?? undefined,
    redemption_code: claim.redemption_code ?? undefined,
    pickup_note: claim.pickup_note,
  });
});
