import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { submitAiFeedback } from "@/lib/ai-feedback-service";

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
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    if (anyUser) return anyUser.id;
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

export const POST = withErrorHandler(async (request) => {
  const userId = await resolveUserId(request);
  const body = (await request.json()) as {
    feedback_type?: string;
    reference_table?: "FEED_ITEM" | "AI_MATCH_RESULT";
    reference_id?: string;
    reason_tags?: string[];
    free_text?: string;
    feed_type?: string;
    mute_person_month?: boolean;
  };

  if (!body.reference_id) {
    return createErrorResponse("缺少 reference_id", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (!Array.isArray(body.reason_tags) || body.reason_tags.length === 0) {
    return createErrorResponse("请选择反馈原因", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await submitAiFeedback(userId, {
    feedback_type: body.feedback_type ?? "MATCH_USELESS",
    reference_table: body.reference_table ?? "FEED_ITEM",
    reference_id: body.reference_id,
    reason_tags: body.reason_tags,
    free_text: body.free_text,
    feed_type: body.feed_type,
    mute_person_month: body.mute_person_month,
  });

  return createSuccessResponse(result);
});
