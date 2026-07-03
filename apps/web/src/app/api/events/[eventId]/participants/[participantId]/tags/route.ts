import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { serializeParticipantRow } from "@/lib/participant-serialize";
import { normalizeParticipantTags } from "@/lib/participant-tags";

const patchSchema = z.object({
  tags: z.array(z.string().max(80)).max(30),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  const tags = normalizeParticipantTags(parsed.data.tags);

  const updated = await prisma.participant.update({
    where: { id: participantId },
    data: { tags },
    include: {
      checkIns: { where: { eventId }, take: 1, orderBy: { checkedInAt: "desc" } },
      registrations: {
        take: 1,
        include: { ticketType: { select: { id: true, name: true } } },
      },
      _count: { select: { leads: true } },
    },
  });

  return createSuccessResponse(serializeParticipantRow(updated, eventId));
});
