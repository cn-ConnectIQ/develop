import { prisma, type Prisma } from "@connectiq/database";

/** 从关联表汇总组织统计字段（member / follower / event） */
export async function syncOrganizationStats(
  orgId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const [memberCount, followerCount, eventCount] = await Promise.all([
    db.orgMember.count({ where: { orgId } }),
    db.orgMember.count({ where: { orgId, isFollowing: true } }),
    db.event.count({ where: { orgId } }),
  ]);

  return db.organization.update({
    where: { id: orgId },
    data: { memberCount, followerCount, eventCount },
    select: { memberCount: true, followerCount: true, eventCount: true },
  });
}
