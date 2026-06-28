import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import {
  submitPollResponse,
  type PollParticipationInput,
} from "@/lib/interaction/session-service";

const respondSchema = z.object({
  option_id: z.string().min(1).optional(),
  option_ids: z.array(z.string().min(1)).optional(),
  text_answer: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});


export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const pollInput: PollParticipationInput = {
    poll_id: pollId,
    option_id: parsed.data.option_id,
    option_ids: parsed.data.option_ids,
    text_answer: parsed.data.text_answer,
    rating: parsed.data.rating,
  };

  const response = await submitPollResponse(eventId, userId, pollInput);

  return createSuccessResponse({ response });
});
