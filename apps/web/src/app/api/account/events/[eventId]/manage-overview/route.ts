import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventManageOverview } from "@/lib/account-manage-overview-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

/** AD2/AD3/AD4 活动管理概览（移动端管理者模式） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const data = await getEventManageOverview(orgId, eventId);
  return createSuccessResponse(data);
});
