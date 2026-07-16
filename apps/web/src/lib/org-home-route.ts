import type { AccountType } from "@connectiq/database";

/** 账号管理员登录后默认进入主办方个人中心 */
export function getOrgHomeRouteByAccountType(_accountType?: string): string {
  return "/organizer/dashboard";
}

export async function resolveOrgHomeRoute(
  _orgId: string,
  _accountType?: AccountType | null,
): Promise<string> {
  return "/organizer/dashboard";
}
