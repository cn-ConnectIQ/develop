import {
  InviteStatus,
  OrgStaffRole,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { resolveScanOperatorRole } from "@/lib/scan/permissions";

export type OperatorStampPoint = {
  stamp_id: string;
  name: string;
  booth_id: string | null;
  icon: string | null;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function activeRallyIds(eventId: string): Promise<string[]> {
  const rallies = await prisma.stampRally.findMany({
    where: { eventId, status: StampRallyStatus.ACTIVE },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return rallies.map((r) => r.id);
}

async function exhibitorBoothIds(
  operatorId: string,
  eventId: string,
): Promise<string[]> {
  const booths = await prisma.exhibitorBooth.findMany({
    where: {
      eventId,
      OR: [
        { operatorUserId: operatorId },
        {
          companyOrg: {
            staff: {
              some: {
                userId: operatorId,
                status: InviteStatus.ACCEPTED,
                role: {
                  in: [
                    OrgStaffRole.OWNER,
                    OrgStaffRole.ADMIN,
                    OrgStaffRole.OPERATOR,
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return booths.map((b) => b.id);
}

function mapStampRows(
  rows: Array<{
    id: string;
    name: string;
    boothId: string | null;
    icon: string | null;
  }>,
): OperatorStampPoint[] {
  return rows.map((s) => ({
    stamp_id: s.id,
    name: s.name,
    booth_id: s.boothId,
    icon: s.icon,
  }));
}

/** 操作员可负责的集章打卡点 */
export async function listOperatorStampPoints(
  eventId: string,
  operatorId: string,
  opts?: { boothId?: string },
): Promise<OperatorStampPoint[]> {
  const rallyIds = await activeRallyIds(eventId);
  if (rallyIds.length === 0) return [];

  const role = await resolveScanOperatorRole(operatorId, eventId);
  const boothFilter = opts?.boothId?.trim();

  if (role === "ORGANIZER" || role === "ORGANIZER_STAFF") {
    const stamps = await prisma.stamp.findMany({
      where: {
        rallyId: { in: rallyIds },
        ...(boothFilter ? { boothId: boothFilter } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, boothId: true, icon: true },
    });
    return mapStampRows(stamps);
  }

  const boothIds = boothFilter
    ? [boothFilter]
    : await exhibitorBoothIds(operatorId, eventId);
  if (boothIds.length === 0) return [];

  const stamps = await prisma.stamp.findMany({
    where: {
      rallyId: { in: rallyIds },
      boothId: { in: boothIds },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, boothId: true, icon: true },
  });
  return mapStampRows(stamps);
}

/** 今日在某打卡点的盖章人次 */
export async function countTodayStampsAtPoint(stampId: string): Promise<number> {
  return prisma.userStamp.count({
    where: {
      stampId,
      collectedAt: { gte: startOfToday() },
    },
  });
}
