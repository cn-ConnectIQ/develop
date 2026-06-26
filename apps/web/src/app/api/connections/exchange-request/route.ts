import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { createWechatExchangeRequest } from "@/lib/connect-card-service";
import { notifyIncomingExchangeRequest } from "@/lib/exchange-request-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { prisma } from "@connectiq/database";

const bodySchema = z.object({
  target_user_id: z.string().min(1),
  event_id: z.string().optional(),
  booth_id: z.string().optional(),
  message: z.string().max(500).optional(),
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

  const result = await createWechatExchangeRequest({
    viewerId,
    targetUserId: parsed.data.target_user_id,
    eventId: parsed.data.event_id,
    boothId: parsed.data.booth_id,
    message: parsed.data.message,
    fromAiMatch: parsed.data.from_ai_match,
    aiMatchScore: parsed.data.ai_match_score,
  });

  const [fromUser, event] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { name: true },
    }),
    parsed.data.event_id
      ? prisma.event.findUnique({
          where: { id: parsed.data.event_id },
          select: { name: true },
        })
      : null,
  ]);

  if (fromUser) {
    await notifyIncomingExchangeRequest(
      parsed.data.target_user_id,
      fromUser.name,
      event?.name,
      result.request_id ?? result.requestId,
    );
  }

  return createSuccessResponse(result);
});
