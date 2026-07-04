import { prisma, type Prisma, LotteryCategory } from "@connectiq/database";
import { serializeLeadFormConfig, normalizeLeadFormConfig } from "@/lib/lead-form/normalize";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
  type AuthSession,
} from "@/lib/api-auth";
import {
  assertExhibitorCanCreateLottery,
  listLotteries,
  listMobileParticipantLotteries,
  listParticipantLotteries,
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";
import { createLotterySchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";
import { createOrganizerLotterySchema } from "@/lib/lottery/organizer-lottery-config";
import {
  getOrganizerGrandLottery,
  listOrganizerGrandLotteries,
  upsertOrganizerGrandLottery,
} from "@/lib/lottery/organizer-lottery-service";
import { isPoolDrawCategory } from "@/lib/lottery/big-screen-lottery-utils";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccessMobileOrWeb(request, eventId);

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const lotteryId = searchParams.get("lottery_id");
  const scope = searchParams.get("scope");
  const boothId = searchParams.get("boothId")?.trim() || undefined;

  if (scope === "ALL" || scope === "MY_BOOTH") {
    let userId: string | undefined;
    if (scope === "MY_BOOTH") {
      if (!boothId) {
        return createErrorResponse("缺少 boothId", ErrorCode.VALIDATION_ERROR, 400);
      }
      const { session } = await requireBoothAccessForRequest(request, boothId);
      userId = session.user.id;
    } else {
      try {
        const mobile = await requireMobileEventAccess(request, eventId);
        userId = mobile.userId;
      } catch {
        await requireEventAccess(eventId);
      }
    }

    const categories = parseParticipantLotteryCategories(category);
    const lotteries = await listMobileParticipantLotteries(eventId, {
      scope,
      boothId,
      categories,
      userId,
    });
    return createSuccessResponse({ lotteries }, { total: lotteries.length });
  }

  if (
    searchParams.get("scope") === "organizer_grand" ||
    isPoolDrawCategory(category)
  ) {
    if (lotteryId) {
      const lottery = await getOrganizerGrandLottery(eventId, lotteryId);
      if (!lottery) {
        return createErrorResponse("抽奖不存在", ErrorCode.NOT_FOUND, 404);
      }
      return createSuccessResponse({ lotteries: [lottery] }, { total: 1 });
    }
    const lotteries = await listOrganizerGrandLotteries(eventId);
    return createSuccessResponse({ lotteries }, { total: lotteries.length });
  }

  if (
    category === "participant" ||
    parseParticipantLotteryCategories(category)
  ) {
    const categories =
      category === "participant"
        ? undefined
        : parseParticipantLotteryCategories(category);
    const lotteries = await listParticipantLotteries(eventId, {
      boothId,
      categories,
    });
    return createSuccessResponse({ lotteries }, { total: lotteries.length });
  }

  const lotteries = await listLotteries(eventId);

  return createSuccessResponse(lotteries, { total: lotteries.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  const body = await request.json();

  const auth = request.headers.get("authorization");
  let createdById: string;
  let webSession: Awaited<ReturnType<typeof requireEventAccess>>["session"] | null =
    null;
  let mobileExhibitorSession: AuthSession | null = null;

  if (auth?.startsWith("Bearer ")) {
    const boothId =
      typeof body?.booth_id === "string" ? body.booth_id.trim() : "";
    if (boothId) {
      const { session } = await requireBoothAccessForRequest(request, boothId);
      mobileExhibitorSession = session;
      createdById = session.user.id;
    } else {
      const { userId } = await requireMobileEventAccess(request, eventId);
      createdById = userId;
    }
  } else {
    const { session } = await requireEventAccess(eventId);
    webSession = session;
    createdById = session.user.id;
  }

  if (webSession) {
    await requireLotteryManageAccess(webSession, eventId);
  }

  const isOrganizerGrand =
    body?.owner_type === "ORGANIZER" ||
    body?.eligibility != null ||
    body?.screen_animation != null ||
    (Array.isArray(body?.prizes) &&
      body.prizes.length > 0 &&
      body.prizes[0]?.quantity != null);

  if (isOrganizerGrand && webSession !== null) {
    const orgParsed = createOrganizerLotterySchema.safeParse(body);
    if (!orgParsed.success) {
      return createErrorResponse(
        orgParsed.error.issues[0]?.message ?? "参数错误",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
    const lottery = await upsertOrganizerGrandLottery(
      eventId,
      webSession,
      orgParsed.data,
    );
    return createSuccessResponse(lottery);
  }

  const parsed = createLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (webSession) {
    await assertExhibitorCanCreateLottery(
      webSession,
      eventId,
      parsed.data.booth_id,
    );
  } else if (mobileExhibitorSession) {
    await assertExhibitorCanCreateLottery(
      mobileExhibitorSession,
      eventId,
      parsed.data.booth_id,
    );
  }

  const prizeTotal = parsed.data.prizes.reduce(
    (sum, p) => sum + (p.count ?? 1),
    0,
  );
  const winnerCount =
    parsed.data.winner_count ?? (prizeTotal > 0 ? prizeTotal : 1);

  const leadFormConfig = parsed.data.lead_form_config
    ? (serializeLeadFormConfig(
        normalizeLeadFormConfig(parsed.data.lead_form_config),
      ) as Prisma.InputJsonValue)
    : undefined;

  const lottery = await prisma.lottery.create({
    data: {
      eventId,
      createdById,
      boothId: parsed.data.booth_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      prizes: parsed.data.prizes,
      requireCheckin: parsed.data.require_checkin ?? false,
      requirePollId: parsed.data.require_poll_id ?? null,
      eligibleRoles: parsed.data.eligible_roles ?? [],
      quizPollId: parsed.data.quiz_poll_id ?? null,
      winnerCount,
      allowReenter: parsed.data.allow_reenter ?? false,
      requireLeadCapture: parsed.data.require_lead_capture ?? true,
      ...(leadFormConfig ? { leadFormConfig } : {}),
    },
    include: {
      booth: { select: { id: true, name: true, code: true } },
      _count: { select: { entries: true, winners: true } },
    },
  });

  return createSuccessResponse(lottery);
});

function parseParticipantLotteryCategories(
  raw: string | null,
): LotteryCategory[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const mapped = parts
    .map((item) => {
      if (item === "AUTO_PROBABILITY") return LotteryCategory.AUTO_PROBABILITY;
      if (item === "INSTANT_CLAIM") return LotteryCategory.INSTANT_CLAIM;
      return null;
    })
    .filter((item): item is LotteryCategory => item != null);
  return mapped.length > 0 ? mapped : undefined;
}
