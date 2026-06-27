import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { verifyEventJoinCode } from "@/lib/event-join-code-service";

const bodySchema = z.object({
  code: z.string().min(1).max(32),
});

/** Z1 活动码校验 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("请输入活动码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await verifyEventJoinCode(parsed.data.code);
  return createSuccessResponse({ event });
});
