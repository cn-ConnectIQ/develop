import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  listPendingExhibitorReviews,
  reviewExhibitorBooth,
} from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

const patchSchema = z.object({
  booth_id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

/** AD3 展商审核列表 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const items = await listPendingExhibitorReviews(eventId, orgId);
  return createSuccessResponse(items);
});

/** AD3 展商审核操作 */
export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const raw = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return createErrorResponse("参数无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await reviewExhibitorBooth(
    orgId,
    eventId,
    parsed.data.booth_id,
    parsed.data.action,
  );
  return createSuccessResponse(result);
});
