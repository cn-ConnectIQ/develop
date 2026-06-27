import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventStampMonitor } from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

/** AD3 集章监控 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const data = await getEventStampMonitor(orgId, eventId);
  return createSuccessResponse(data);
});
