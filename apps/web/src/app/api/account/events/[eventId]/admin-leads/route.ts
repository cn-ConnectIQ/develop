import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createAdminEventLead,
  listAdminEventLeads,
} from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

const postSchema = z.object({
  visitor_user_id: z.string().min(1),
  name: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  intent_track: z.string().optional(),
  intent_level: z.enum(["A", "B", "C"]),
  note: z.string().max(2000).optional(),
  ai_grade_reason: z.string().optional(),
  booth_id: z.string().optional(),
});

/** AD4 活动线索列表 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? "50"), 1),
    100,
  );

  const leads = await listAdminEventLeads(orgId, eventId, limit);
  return createSuccessResponse(leads);
});

/** AD5 管理者扫码采集线索 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await createAdminEventLead(orgId, eventId, parsed.data);
  return createSuccessResponse(result);
});
