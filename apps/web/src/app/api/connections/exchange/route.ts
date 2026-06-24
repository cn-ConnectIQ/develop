import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import { ExchangeMethod } from "@connectiq/database";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { performWechatExchange } from "@/lib/connect-card-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const bodySchema = z.object({
  target_user_id: z.string().min(1),
  event_id: z.string().optional(),
  booth_id: z.string().optional(),
  method: z.nativeEnum(ExchangeMethod).optional(),
  from_ai_match: z.boolean().optional(),
  ai_match_score: z.number().optional(),
});

export const POST = withErrorHandler(async (request) => {
  const viewerId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await performWechatExchange({
    viewerId,
    targetUserId: parsed.data.target_user_id,
    eventId: parsed.data.event_id,
    boothId: parsed.data.booth_id,
    method: parsed.data.method ?? ExchangeMethod.FACE_TO_FACE,
    fromAiMatch: parsed.data.from_ai_match,
    aiMatchScore: parsed.data.ai_match_score,
  });

  return createSuccessResponse(result);
});
