import {
  AccountType,
  EventType,
  prisma,
  type Prisma,
} from "@connectiq/database";

/** 账号管理员切换组织后的默认首页 */
export function getOrgHomeRouteByAccountType(accountType: string): string {
  const routes: Record<string, string> = {
    ORGANIZATION: "/events",
    CONFERENCE_ORGANIZER: "/events",
    EXPO_ORGANIZER: "/events",
    EXHIBITOR: "/events",
  };
  return routes[accountType] ?? "/events";
}

export async function resolveOrgHomeRoute(
  orgId: string,
  accountType: AccountType,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  switch (accountType) {
    case AccountType.EXPO_ORGANIZER: {
      const event = await db.event.findFirst({
        where: { orgId, type: EventType.EXPO },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      return event ? `/expos/${event.id}` : "/events";
    }
    case AccountType.EXHIBITOR: {
      const booth = await db.exhibitorBooth.findFirst({
        where: { companyOrgId: orgId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      return booth ? `/exhibitor/booths/${booth.id}` : "/events";
    }
    case AccountType.ORGANIZATION:
    case AccountType.CONFERENCE_ORGANIZER:
    default:
      return "/events";
  }
}
