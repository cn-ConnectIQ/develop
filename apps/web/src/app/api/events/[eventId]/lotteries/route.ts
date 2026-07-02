import { prisma, type Prisma } from "@connectiq/database";
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
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";
import { createLotterySchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";
import { createOrganizerLotterySchema } from "@/lib/lottery/organizer-lottery-config";
import {
  listOrganizerGrandLotteries,
  upsertOrganizerGrandLottery,
} from "@/lib/lottery/organizer-lottery-service";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("scope") === "organizer_grand") {
    const lotteries = await listOrganizerGrandLotteries(eventId);
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
