import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import { parseLeadNote } from "@/lib/ai/lead-note-parser";
import { isLLMConfigured, LlmError } from "@/lib/ai/llm";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const bodySchema = z.object({
  note: z.string().min(1).max(2000),
});

/** 展商采集 · AI 整理销售笔记为结构化 CRM 字段 */
export const POST = withErrorHandler(async (request) => {
  await resolveMobileUserId(request);

  if (!isLLMConfigured()) {
    return createErrorResponse(
      "AI 服务未配置",
      ErrorCode.INTERNAL_ERROR,
      503,
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const result = await parseLeadNote(parsed.data.note);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof LlmError) {
      const status = err.code === "NOT_CONFIGURED" ? 503 : 502;
      return createErrorResponse(
        err.message || "AI服务暂时不可用,请稍后重试",
        ErrorCode.INTERNAL_ERROR,
        status,
      );
    }
    throw err;
  }
});
