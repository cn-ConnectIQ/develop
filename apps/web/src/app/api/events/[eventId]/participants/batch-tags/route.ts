import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  mergeParticipantTags,
  normalizeParticipantTags,
} from "@/lib/participant-tags";

const batchTagsSchema = z.object({
  participantIds: z.array(z.string()).min(1),
  tags: z.array(z.string().max(80)).min(1).max(30),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = batchTagsSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const tagsToAdd = normalizeParticipantTags(parsed.data.tags);
  const participants = await prisma.participant.findMany({
    where: { eventId, id: { in: parsed.data.participantIds } },
    select: { id: true, tags: true },
  });

  if (participants.length === 0) {
    return createErrorResponse("未找到参会者", ErrorCode.NOT_FOUND, 404);
  }

  await Promise.all(
    participants.map((p) =>
      prisma.participant.update({
        where: { id: p.id },
        data: { tags: mergeParticipantTags(p.tags, tagsToAdd) },
      }),
    ),
  );

  return createSuccessResponse({
    updated: participants.length,
    tags: tagsToAdd,
  });
});
