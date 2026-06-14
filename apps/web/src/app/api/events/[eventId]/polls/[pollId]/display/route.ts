import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getPollDisplayConfig,
  updatePollDisplayConfig,
} from "@/lib/bigscreen-service";

const patchSchema = z.object({
  showResults: z.boolean().optional(),
  featuredResponseId: z.string().nullable().optional(),
  hideResponseId: z.string().optional(),
  unhideResponseId: z.string().optional(),
  pinResponseId: z.string().optional(),
  unpinResponseId: z.string().optional(),
  markAnsweredResponseId: z.string().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const current = await getPollDisplayConfig(eventId, pollId);

  const hidden = new Set(current.hiddenResponseIds);
  const pinned = new Set(current.pinnedResponseIds);
  const answered = new Set(current.answeredResponseIds);

  if (parsed.data.hideResponseId) hidden.add(parsed.data.hideResponseId);
  if (parsed.data.unhideResponseId) hidden.delete(parsed.data.unhideResponseId);
  if (parsed.data.pinResponseId) pinned.add(parsed.data.pinResponseId);
  if (parsed.data.unpinResponseId) pinned.delete(parsed.data.unpinResponseId);
  if (parsed.data.markAnsweredResponseId) {
    answered.add(parsed.data.markAnsweredResponseId);
  }

  const updated = await updatePollDisplayConfig(eventId, pollId, {
    showResults: parsed.data.showResults,
    featuredResponseId:
      parsed.data.featuredResponseId !== undefined
        ? parsed.data.featuredResponseId
        : current.featuredResponseId,
    hiddenResponseIds: [...hidden],
    pinnedResponseIds: [...pinned],
    answeredResponseIds: [...answered],
  });

  return createSuccessResponse(updated);
});
