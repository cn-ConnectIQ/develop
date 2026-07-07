import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  generateMeetingIcebreaker,
  normalizeIcebreakerProfile,
} from "@/lib/ai/meeting-icebreaker-service";
import { isLLMConfigured, LlmError } from "@/lib/ai/llm";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const profileSchema = z.record(z.unknown());

const bodySchema = z.object({
  requesterProfile: profileSchema,
  targetProfile: profileSchema,
});

/** MEET-MO-02 · AI 生成会面破冰开场白 */
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

  const requesterProfile = normalizeIcebreakerProfile(
    parsed.data.requesterProfile,
  );
  const targetProfile = normalizeIcebreakerProfile(parsed.data.targetProfile);

  if (!requesterProfile) {
    return createErrorResponse(
      "requesterProfile.name 不能为空",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
  if (!targetProfile) {
    return createErrorResponse(
      "targetProfile.name 不能为空",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const suggestion = await generateMeetingIcebreaker({
      requesterProfile,
      targetProfile,
    });
    return createSuccessResponse({ suggestion });
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
