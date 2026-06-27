import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { predictAcceptRate } from "@/lib/mobile-ai-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const bodySchema = z.object({
  target_user_id: z.string().min(1),
  request_note: z.string().default(""),
  event_id: z.string().optional(),
});

/** 连接请求接受率预测 */
export const POST = withErrorHandler(async (request) => {
  const viewerId = await resolveMobileUserId(request);
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return createErrorResponse("参数无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const accept_rate = await predictAcceptRate(
    viewerId,
    parsed.data.target_user_id,
    parsed.data.request_note,
    parsed.data.event_id,
  );
  return createSuccessResponse({ accept_rate });
});
