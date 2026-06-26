import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { getAccountOverview } from "@/lib/account-mobile-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

/** 账号管理中心概览（移动端管理者模式） */
export const GET = withErrorHandler(async (request) => {
  const { orgId } = await requireMobileAccountAdmin(request);
  const data = await getAccountOverview(orgId);
  return createSuccessResponse(data);
});
