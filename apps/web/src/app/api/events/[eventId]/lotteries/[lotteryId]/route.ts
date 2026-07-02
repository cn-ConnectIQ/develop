import { LotteryStatus, prisma, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  assertStatusTransition,
  getLotteryMobileDetail,
  getLotteryOrThrow,
  listLotteryWinners,
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";
import { pushLotteryToAttendees } from "@/lib/interaction-push-service";
import { patchLotterySchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";
import {
  normalizeLeadFormConfig,
  serializeLeadFormConfig,
} from "@/lib/lead-form/normalize";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertAttendeeReadableEvent(eventId);

  const userId = await resolveOptionalMobileUserId(request);
  const mobile = await getLotteryMobileDetail(eventId, lotteryId, userId);
  const winners = await listLotteryWinners(eventId, lotteryId);

  return createSuccessResponse({
    ...mobile,
    winners,
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;
  const lottery = await getLotteryOrThrow(eventId, lotteryId);
  await requireLotteryManageAccess(session, eventId, lottery);

  const body = await request.json();
  const parsed = patchLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (parsed.data.status && parsed.data.status !== lottery.status) {
    assertStatusTransition(lottery.status, parsed.data.status);
  }

  const leadFormConfig = parsed.data.lead_form_config
    ? (serializeLeadFormConfig(
        normalizeLeadFormConfig(parsed.data.lead_form_config),
      ) as Prisma.InputJsonValue)
    : undefined;

  const updated = await prisma.lottery.update({
    where: { id: lotteryId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      status: parsed.data.status,
      prizes: parsed.data.prizes,
      requireCheckin: parsed.data.require_checkin,
      requirePollId: parsed.data.require_poll_id,
      eligibleRoles: parsed.data.eligible_roles,
      quizPollId: parsed.data.quiz_poll_id,
      winnerCount: parsed.data.winner_count,
      allowReenter: parsed.data.allow_reenter,
      ...(parsed.data.require_lead_capture !== undefined
        ? { requireLeadCapture: parsed.data.require_lead_capture }
        : {}),
      ...(leadFormConfig ? { leadFormConfig } : {}),
      drawnAt:
        parsed.data.status === LotteryStatus.FINISHED ? new Date() : undefined,
    },
    include: {
      booth: { select: { id: true, name: true, code: true } },
      _count: { select: { entries: true, winners: true } },
    },
  });

  let pushResult = null;
  const shouldPush =
    parsed.data.status === LotteryStatus.OPEN &&
    lottery.status !== LotteryStatus.OPEN &&
    parsed.data.push !== false;
  if (shouldPush) {
    try {
      pushResult = await pushLotteryToAttendees(eventId, lotteryId);
    } catch {
      pushResult = { sent: 0, skipped: 0, total: 0, error: true };
    }
  }

  return createSuccessResponse({ ...updated, pushResult });
});
