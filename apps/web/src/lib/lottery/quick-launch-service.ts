import {
  LotteryCategory,
  LotteryDrawType,
  LotteryOwnerType,
  LotteryStatus,
  LotteryType,
  PrizeType,
  TriggerAction,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import {
  claimInstantLotteryGift,
  type BoothLotteryLeadInput,
} from "@/lib/interaction/lottery-service";
import { createInteractionSession } from "@/lib/interaction/session-service";
import type { InteractionRef } from "@/lib/interaction/schemas";
import {
  normalizeLeadFormConfig,
  serializeLeadFormConfig,
} from "@/lib/lead-form/normalize";
import { getInteractionScanUrl } from "@/lib/qrcode";
import type { CreateBoothLotteryInput } from "@/lib/lottery/booth-lottery-schemas";
import {
  isFillGetGiftTemplate,
  QUICK_LAUNCH_CODE_03B,
  QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
} from "@/lib/lottery/quick-launch-templates";

function mapLegacyPrizes(prizes: CreateBoothLotteryInput["prizes"]) {
  return prizes.map((prize, index) => ({
    rank: index + 1,
    name: prize.name,
    prize: prize.name,
    count: prize.quantity,
    image_url: prize.image_url,
  }));
}

function mapPrizeType(raw: CreateBoothLotteryInput["prizes"][number]["prize_type"]) {
  if (raw === "DIGITAL") return PrizeType.DIGITAL;
  if (raw === "EXPERIENCE") return PrizeType.EXPERIENCE;
  return PrizeType.PHYSICAL;
}

type QuickLaunchContext = {
  sessionId: string;
  eventId: string;
  boothId: string | null;
  template: string;
  lotteryId: string;
};

export type QuickLaunchEnterInput = {
  name: string;
  phone: string;
  company?: string;
  title?: string;
  form_data?: Record<string, string>;
};

export async function loadQuickLaunchContext(launchId: string): Promise<QuickLaunchContext> {
  const session = await prisma.interactionSession.findUnique({
    where: { id: launchId },
    select: {
      id: true,
      eventId: true,
      boothId: true,
      isActive: true,
      settings: true,
      interactions: true,
    },
  });

  if (!session || !session.isActive) {
    throw new ApiError("快速发起不存在或已关闭", ErrorCode.NOT_FOUND, 404);
  }

  const settings =
    session.settings &&
    typeof session.settings === "object" &&
    !Array.isArray(session.settings)
      ? (session.settings as Record<string, unknown>)
      : {};

  const template =
    (typeof settings.quickLaunchTemplate === "string" &&
      settings.quickLaunchTemplate) ||
    (typeof settings.template === "string" && settings.template) ||
    null;

  if (!template) {
    throw new ApiError("无效的快速发起配置", ErrorCode.VALIDATION_ERROR, 400);
  }

  const interactions = Array.isArray(session.interactions)
    ? (session.interactions as InteractionRef[])
    : [];
  const lotteryRef = interactions.find((item) => item.type === "lottery");
  if (!lotteryRef) {
    throw new ApiError("未关联抽奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  return {
    sessionId: session.id,
    eventId: session.eventId,
    boothId: session.boothId,
    template,
    lotteryId: lotteryRef.id,
  };
}

export async function createFillGetGiftQuickLaunch(
  boothId: string,
  session: AuthSession,
  input: CreateBoothLotteryInput,
) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      eventId: true,
      code: true,
      name: true,
      companyOrgId: true,
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const legacyPrizes = mapLegacyPrizes(input.prizes);
  const prizeTotal = input.prizes.reduce((sum, prize) => sum + prize.quantity, 0);
  const winnerCount = Math.max(prizeTotal, 1);
  const leadFormConfig = serializeLeadFormConfig(
    normalizeLeadFormConfig(input.lead_form_config ?? { fields: [] }),
  );
  const status = input.publish ? LotteryStatus.ACTIVE : LotteryStatus.DRAFT;

  const lottery = await prisma.$transaction(async (tx) => {
    const created = await tx.lottery.create({
      data: {
        eventId: booth.eventId,
        createdById: session.user.id,
        ownerType: LotteryOwnerType.EXHIBITOR,
        boothId: booth.id,
        title: input.title,
        description: input.description,
        coverImage: input.prizes[0]?.image_url ?? null,
        drawType: LotteryDrawType.INSTANT,
        status,
        type: LotteryType.RANDOM,
        lotteryCategory: LotteryCategory.INSTANT_CLAIM,
        triggerAction: TriggerAction.FILL_FORM,
        prizes: legacyPrizes,
        winnerCount,
        requireLeadCapture: true,
        leadFormConfig,
        maxEntriesPerUser: 1,
        allowReenter: false,
      },
    });

    for (const [index, prize] of input.prizes.entries()) {
      await tx.lotteryPrize.create({
        data: {
          lotteryId: created.id,
          name: prize.name,
          imageUrl: prize.image_url ?? null,
          quantity: prize.quantity,
          remaining: prize.quantity,
          prizeType: mapPrizeType(prize.prize_type),
          sortOrder: index,
          probability: 1,
        },
      });
    }

    return created;
  });

  let interaction = null;
  if (input.publish) {
    const interactionSession = await createInteractionSession({
      eventId: booth.eventId,
      createdById: session.user.id,
      name: input.title,
      interactions: [{ type: "lottery", id: lottery.id }],
      boothId: booth.id,
      exhibitorOrgId: booth.companyOrgId,
      ownerType: "EXHIBITOR",
      settings: {
        quickLaunchTemplate: QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
        quickLaunchCode: QUICK_LAUNCH_CODE_03B,
        requireLeadCapture: true,
      },
    });

    interaction = {
      quick_launch_id: interactionSession.id,
      session_id: interactionSession.id,
      session_code: interactionSession.sessionCode,
      qr_url: interactionSession.qrUrl,
      scan_url: getInteractionScanUrl(interactionSession.sessionCode),
    };
  }

  return {
    template: QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
    template_code: QUICK_LAUNCH_CODE_03B,
    lottery: {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      lottery_category: lottery.lotteryCategory,
      trigger_action: lottery.triggerAction,
      require_lead_capture: lottery.requireLeadCapture,
    },
    interaction,
  };
}

async function enterFillGetGiftQuickLaunch(
  ctx: QuickLaunchContext,
  userId: string,
  input: QuickLaunchEnterInput,
) {
  const lead: BoothLotteryLeadInput = {
    name: input.name,
    phone: input.phone,
    company: input.company,
    title: input.title,
  };
  if (input.form_data) {
    Object.assign(lead, input.form_data);
  }

  const result = await claimInstantLotteryGift(ctx.lotteryId, userId, lead);

  return {
    template: QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
    template_code: QUICK_LAUNCH_CODE_03B,
    lottery_id: result.lottery_id,
    has_entered: true,
    won: result.won,
    prize_tier:
      result.prize_tier != null ? `${result.prize_tier}等奖` : undefined,
    prize_name: result.prize_name ?? undefined,
    redemption_code: result.redemption_code ?? undefined,
    pickup_note: result.pickup_note,
  };
}

export async function enterQuickLaunch(
  launchId: string,
  userId: string,
  input: QuickLaunchEnterInput,
) {
  const ctx = await loadQuickLaunchContext(launchId);

  if (isFillGetGiftTemplate(ctx.template)) {
    return enterFillGetGiftQuickLaunch(ctx, userId, input);
  }

  throw new ApiError("不支持的快速发起模板", ErrorCode.VALIDATION_ERROR, 400);
}

export async function createQuickLaunch(
  boothId: string,
  session: AuthSession,
  template: string,
  input: CreateBoothLotteryInput,
) {
  if (isFillGetGiftTemplate(template)) {
    return createFillGetGiftQuickLaunch(boothId, session, input);
  }

  throw new ApiError("不支持的快速发起模板", ErrorCode.VALIDATION_ERROR, 400);
}
