import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getEventMobileQna,
  submitEventMobileQnaQuestion,
} from "@/lib/mobile-qna-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

const postSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  text_answer: z.string().min(1).max(500).optional(),
  question: z.string().min(1).max(500).optional(),
});

/** 现场问答：列表 + 提问 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await getEventMobileQna(eventId, userId);
  return createSuccessResponse(data);
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const text =
    parsed.data.text ?? parsed.data.text_answer ?? parsed.data.question ?? "";
  const item = await submitEventMobileQnaQuestion(eventId, userId, text);
  return createSuccessResponse(item);
});
