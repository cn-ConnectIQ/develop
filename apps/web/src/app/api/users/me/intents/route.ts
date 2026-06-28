import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { fetchMeIntents, saveMeIntents } from "@/lib/user-me-service";

const intentItemSchema = z.union([
  z.string().min(1).max(128),
  z.object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(128),
    type: z.enum(["SUPPLY", "DEMAND"]).optional(),
  }),
]);

const postBodySchema = z.object({
  intents: z.array(intentItemSchema).max(50),
  status: z.literal("ACTIVE").optional(),
});

export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const intents = await fetchMeIntents(userId);
  return createSuccessResponse({ intents });
});

/** 保存 onboarding / 个人资料意图标签 */
export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数校验失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const intents = await saveMeIntents(userId, parsed.data.intents, {
    markActive: parsed.data.status === "ACTIVE",
  });
  return createSuccessResponse({ intents });
});
