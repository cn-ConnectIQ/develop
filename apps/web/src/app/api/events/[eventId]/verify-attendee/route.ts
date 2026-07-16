import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { normalizeInvitePhone } from "@/lib/invite/phone";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

async function userNeedsIntent(userId: string, eventId: string): Promise<boolean> {
  const intent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: {
      supplyTags: true,
      demandTags: true,
      role: true,
      topics: true,
      rawIntentText: true,
    },
  });
  if (!intent) return true;
  return !(
    Boolean(intent.role?.trim()) ||
    Boolean(intent.rawIntentText?.trim()) ||
    intent.supplyTags.length > 0 ||
    intent.demandTags.length > 0 ||
    intent.topics.length > 0
  );
}

/**
 * POST /api/events/:eventId/verify-attendee
 * 活动通用码扫入后：用当前登录用户手机号核对参会名单。
 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const userId = await resolveMobileUserId(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true },
  });
  if (!user) {
    return createErrorResponse("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const phone = user.phone ? normalizeInvitePhone(user.phone) : null;
  if (!phone) {
    return createErrorResponse(
      "当前账号未绑定有效手机号，无法核验参会资格",
      ErrorCode.FORBIDDEN,
      403,
    );
  }

  const participant = await prisma.participant.findFirst({
    where: {
      eventId,
      OR: [
        { phone },
        { phone: { endsWith: phone } },
        { phone: `+86${phone}` },
        { phone: `86${phone}` },
      ],
    },
    select: { id: true, name: true },
  });

  if (!participant) {
    return createErrorResponse(
      "该手机号不在本场参会名单",
      ErrorCode.FORBIDDEN,
      403,
    );
  }

  const needsIntent = await userNeedsIntent(userId, eventId);

  return createSuccessResponse({
    matched: true,
    needs_intent: needsIntent,
    eventId: event.id,
    eventName: event.name,
    phone,
    participantId: participant.id,
  });
});
