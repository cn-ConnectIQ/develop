import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listAdminEventLeads } from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

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
