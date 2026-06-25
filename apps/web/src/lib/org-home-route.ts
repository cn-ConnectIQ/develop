import type { AccountType } from "@connectiq/database";

/** 账号管理员登录后默认进入活动列表 */
export function getOrgHomeRouteByAccountType(_accountType?: string): string {
  return "/events";
}

export async function resolveOrgHomeRoute(
  _orgId: string,
  _accountType?: AccountType | null,
): Promise<string> {
  return "/events";
}
