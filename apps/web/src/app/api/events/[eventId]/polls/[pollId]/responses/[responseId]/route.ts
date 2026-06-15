import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getPollDisplayConfig,
  updatePollDisplayConfig,
} from "@/lib/bigscreen-service";

const patchSchema = z.object({
  is_on_screen: z.boolean().optional(),
  is_answered: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  host_note: z.string().max(2000).optional(),
  public_reply: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

function toggleId(ids: string[], id: string, enabled: boolean): string[] {
  if (enabled) {
    return ids.includes(id) ? ids : [...ids, id];
  }
  return ids.filter((x) => x !== id);
}

/** Q&A 问题操作：上屏 / 已回答 / 隐藏 / 备注 */
export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  const responseId = context?.params?.responseId;
  if (!eventId || !pollId || !responseId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireAuth(request, [
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER,
    UserRole.EXPO_ORGANIZER,
  ]);

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const response = await prisma.pollResponse.findFirst({
    where: { id: responseId, pollId, poll: { eventId } },
  });
  if (!response) {
    return createErrorResponse("问题不存在", ErrorCode.NOT_FOUND, 404);
  }

  const display = await getPollDisplayConfig(eventId, pollId);
  const responseMeta = { ...(display.responseMeta ?? {}) };

  if (parsed.data.host_note !== undefined) {
    responseMeta[responseId] = {
      ...responseMeta[responseId],
      hostNote: parsed.data.host_note,
    };
  }
  if (parsed.data.public_reply !== undefined) {
    responseMeta[responseId] = {
      ...responseMeta[responseId],
      publicReply: parsed.data.public_reply,
    };
  }
  if (parsed.data.tags !== undefined) {
    responseMeta[responseId] = {
      ...responseMeta[responseId],
      tags: parsed.data.tags,
    };
  }

  let isOnScreen = response.isOnScreen;
  if (parsed.data.is_on_screen !== undefined) {
    if (parsed.data.is_on_screen) {
      await prisma.pollResponse.updateMany({
        where: { pollId, isOnScreen: true },
        data: { isOnScreen: false },
      });
      isOnScreen = true;
    } else {
      isOnScreen = false;
    }
    await prisma.pollResponse.update({
      where: { id: responseId },
      data: { isOnScreen },
    });
  }

  const displayPatch: Parameters<typeof updatePollDisplayConfig>[2] = {
    responseMeta,
  };

  if (parsed.data.is_answered !== undefined) {
    displayPatch.answeredResponseIds = toggleId(
      display.answeredResponseIds,
      responseId,
      parsed.data.is_answered,
    );
  }

  if (parsed.data.is_hidden !== undefined) {
    displayPatch.hiddenResponseIds = toggleId(
      display.hiddenResponseIds,
      responseId,
      parsed.data.is_hidden,
    );
  }

  if (parsed.data.is_pinned !== undefined) {
    displayPatch.pinnedResponseIds = toggleId(
      display.pinnedResponseIds,
      responseId,
      parsed.data.is_pinned,
    );
  }

  if (parsed.data.is_on_screen === true) {
    displayPatch.featuredResponseId = responseId;
  } else if (parsed.data.is_on_screen === false && display.featuredResponseId === responseId) {
    displayPatch.featuredResponseId = null;
  }

  const nextDisplay = await updatePollDisplayConfig(
    eventId,
    pollId,
    displayPatch,
  );

  const updated = await prisma.pollResponse.findUnique({
    where: { id: responseId },
    include: {
      participant: {
        select: { id: true, name: true, company: true, jobTitle: true },
      },
    },
  });

  return createSuccessResponse({
    id: responseId,
    is_on_screen: updated?.isOnScreen ?? isOnScreen,
    is_answered: nextDisplay.answeredResponseIds.includes(responseId),
    is_hidden: nextDisplay.hiddenResponseIds.includes(responseId),
    is_pinned: nextDisplay.pinnedResponseIds.includes(responseId),
    host_note: nextDisplay.responseMeta?.[responseId]?.hostNote ?? null,
    public_reply: nextDisplay.responseMeta?.[responseId]?.publicReply ?? null,
    tags: nextDisplay.responseMeta?.[responseId]?.tags ?? [],
  });
});

export const DELETE = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  const responseId = context?.params?.responseId;
  if (!eventId || !pollId || !responseId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireAuth(request, [
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER,
    UserRole.EXPO_ORGANIZER,
  ]);

  const response = await prisma.pollResponse.findFirst({
    where: { id: responseId, pollId, poll: { eventId } },
  });
  if (!response) {
    return createErrorResponse("问题不存在", ErrorCode.NOT_FOUND, 404);
  }

  const display = await getPollDisplayConfig(eventId, pollId);

  await prisma.pollResponse.delete({ where: { id: responseId } });

  const responseMeta = { ...(display.responseMeta ?? {}) };
  delete responseMeta[responseId];

  await updatePollDisplayConfig(eventId, pollId, {
    hiddenResponseIds: display.hiddenResponseIds.filter((id) => id !== responseId),
    pinnedResponseIds: display.pinnedResponseIds.filter((id) => id !== responseId),
    answeredResponseIds: display.answeredResponseIds.filter(
      (id) => id !== responseId,
    ),
    featuredResponseId:
      display.featuredResponseId === responseId
        ? null
        : display.featuredResponseId,
    responseMeta,
  });

  return createSuccessResponse({ deleted: true });
});
