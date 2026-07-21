import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { notifyParticipants } from "@/lib/participant-notify-service";
import { prisma } from "@connectiq/database";

const notifySchema = z.object({
  participantIds: z.array(z.string()).optional(),
  /** 显式发给全部参会者；禁止用空列表默认全员 */
  all: z.boolean().optional(),
  /** 仅发给当前登录管理员（真正的测试） */
  testSelf: z.boolean().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  const { session } = await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (parsed.data.testSelf) {
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: `[测试] ${parsed.data.title}`,
        body: parsed.data.body,
      },
    });
    return createSuccessResponse({
      sent: 1,
      skipped: 0,
      total: 1,
      mode: "self",
    });
  }

  let participantIds = parsed.data.participantIds ?? [];
  if (parsed.data.all === true) {
    const all = await prisma.participant.findMany({
      where: { eventId },
      select: { id: true },
    });
    participantIds = all.map((p) => p.id);
  } else if (participantIds.length === 0) {
    return createErrorResponse(
      "请指定收件人，或显式选择发给全部参会者",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await notifyParticipants({
    eventId,
    participantIds,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  return createSuccessResponse({ ...result, mode: parsed.data.all ? "all" : "selected" });
});
