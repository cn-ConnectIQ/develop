import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { assertExhibitorCanCreateLottery } from "@/lib/interaction/lottery-service";
import { createInteractionSession } from "@/lib/interaction/session-service";
import { createInteractionSessionSchema } from "@/lib/interaction/schemas";
import { getAppBaseUrl } from "@/lib/supabase/server";

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = createInteractionSessionSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (session.user.role === UserRole.EXHIBITOR) {
    await assertExhibitorCanCreateLottery(
      session,
      eventId,
      parsed.data.booth_id,
    );
  }

  const pollIds = parsed.data.interactions
    .filter((i) => i.type === "poll")
    .map((i) => i.id);
  const lotteryIds = parsed.data.interactions
    .filter((i) => i.type === "lottery")
    .map((i) => i.id);

  const [pollCount, lotteryCount] = await Promise.all([
    pollIds.length
      ? prisma.poll.count({ where: { eventId, id: { in: pollIds } } })
      : Promise.resolve(0),
    lotteryIds.length
      ? prisma.lottery.count({ where: { eventId, id: { in: lotteryIds } } })
      : Promise.resolve(0),
  ]);

  if (pollCount !== pollIds.length || lotteryCount !== lotteryIds.length) {
    return createErrorResponse(
      "互动项不存在或不属于该活动",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const created = await createInteractionSession({
    eventId,
    createdById: session.user.id,
    name: parsed.data.name,
    interactions: parsed.data.interactions,
    boothId: parsed.data.booth_id,
    channelType: parsed.data.channel_type,
  });

  return createSuccessResponse({
    session_id: created.id,
    session_code: created.sessionCode,
    qr_url: created.qrUrl,
    scanUrl: `${getAppBaseUrl()}/i/${created.sessionCode}`,
    booth: created.booth,
  });
});
