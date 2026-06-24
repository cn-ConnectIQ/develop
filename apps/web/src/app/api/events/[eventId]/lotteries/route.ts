import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  assertExhibitorCanCreateLottery,
  listLotteries,
  requireLotteryManageAccess,
} from "@/lib/interaction/lottery-service";
import { createLotterySchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const lotteries = await listLotteries(eventId);

  return createSuccessResponse(lotteries, { total: lotteries.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;
  await requireLotteryManageAccess(session, eventId);

  const body = await request.json();
  const parsed = createLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  await assertExhibitorCanCreateLottery(session, eventId, parsed.data.booth_id);

  const prizeTotal = parsed.data.prizes.reduce(
    (sum, p) => sum + (p.count ?? 1),
    0,
  );
  const winnerCount =
    parsed.data.winner_count ?? (prizeTotal > 0 ? prizeTotal : 1);

  const lottery = await prisma.lottery.create({
    data: {
      eventId,
      createdById: session.user.id,
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
    },
    include: {
      booth: { select: { id: true, name: true, code: true } },
      _count: { select: { entries: true, winners: true } },
    },
  });

  return createSuccessResponse(lottery);
});
