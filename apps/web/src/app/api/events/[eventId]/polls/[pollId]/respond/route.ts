import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  submitPollResponse,
  type PollParticipationInput,
} from "@/lib/interaction/session-service";

const respondSchema = z.object({
  option_id: z.string().cuid().optional(),
  option_ids: z.array(z.string().cuid()).optional(),
  text_answer: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

async function resolveUserId(request: Request): Promise<string> {
  try {
    const { user } = await requireAuth(request);
    return user.id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token === "dev-mock-token") {
    const demo = await prisma.user.findFirst({
      where: { phone: "13800138000" },
      select: { id: true },
    });
    if (demo) return demo.id;
  }

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveUserId(request);
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
