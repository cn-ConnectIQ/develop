import { LotteryStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  assertStatusTransition,
  getLotteryOrThrow,
  listLotteryWinners,
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";
import { pushLotteryToAttendees } from "@/lib/interaction-push-service";
import { patchLotterySchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const lottery = await getLotteryOrThrow(eventId, lotteryId);
  const winners = await listLotteryWinners(eventId, lotteryId);

  return createSuccessResponse({
    ...lottery,
    winners,
    entryCount: lottery.entryCount,
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
