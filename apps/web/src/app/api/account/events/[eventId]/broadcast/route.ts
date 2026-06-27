import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { sendMobileEventBroadcast } from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

const bodySchema = z.object({
  body: z.string().min(1).max(500),
  title: z.string().max(100).optional(),
  urgent: z.boolean().optional(),
});

/** AD 全场推送 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return createErrorResponse("请输入推送内容", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await sendMobileEventBroadcast(orgId, eventId, parsed.data);
  return createSuccessResponse(result);
});
