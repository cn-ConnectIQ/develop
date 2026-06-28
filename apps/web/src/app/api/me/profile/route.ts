import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { fetchMeUser, updateMeUser } from "@/lib/user-me-service";

const patchBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  company: z.string().max(128).optional(),
  title: z.string().max(128).optional(),
  industry: z.string().max(128).optional(),
  value_proposition: z.string().max(500).optional(),
  avatar_url: z.string().max(2048).optional(),
});

/** 小程序 onboarding / 个人资料 PATCH */
export const PATCH = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = patchBodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数校验失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const user = await updateMeUser(userId, parsed.data);
  return createSuccessResponse(user);
});

export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const user = await fetchMeUser(userId);
  return createSuccessResponse(user);
});
