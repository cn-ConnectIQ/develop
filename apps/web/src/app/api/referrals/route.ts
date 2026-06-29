import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { createReferral, listReferrals } from "@/lib/referrals-service";

const createReferralSchema = z.object({
  user_a_id: z.string().min(1),
  user_b_id: z.string().min(1),
  recipient_id: z.string().min(1).optional(),
  event_id: z.string().min(1).optional(),
  message: z.string().max(500).optional(),
  ai_confidence: z.number().min(0).max(1).optional(),
});

export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") ?? "introducer";
  const limit = Number(searchParams.get("limit") ?? "20");

  if (role !== "introducer" && role !== "recipient") {
    return createErrorResponse("role 参数无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await listReferrals(userId, role, limit);
  return createSuccessResponse(result);
});

export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = createReferralSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const referral = await createReferral(userId, parsed.data);
    return createSuccessResponse(referral);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
