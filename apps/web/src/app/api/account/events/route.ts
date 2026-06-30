import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { listAccountEvents } from "@/lib/account-mobile-service";
import { toMobileAccountEventItem } from "@/lib/mobile-account-response";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

/** 账号管理中心活动列表（移动端管理者模式） */
export const GET = withErrorHandler(async (request) => {
  const { orgId } = await requireMobileAccountAdmin(request);
  const data = await listAccountEvents(orgId);
  return createSuccessResponse(data.map(toMobileAccountEventItem));
});
