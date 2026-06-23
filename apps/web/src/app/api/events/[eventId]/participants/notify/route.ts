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
  all: z.boolean().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  let participantIds = parsed.data.participantIds ?? [];
  if (parsed.data.all || participantIds.length === 0) {
    const all = await prisma.participant.findMany({
      where: { eventId },
      select: { id: true },
    });
    participantIds = all.map((p) => p.id);
  }

  const result = await notifyParticipants({
    eventId,
    participantIds,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  return createSuccessResponse(result);
});
