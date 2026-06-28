import { prisma, type Prisma } from "@connectiq/database";

/** 从业务表汇总 B 端组织跨活动累计指标（主办 + 旗下展位线索/连接） */
export async function syncOrganizationAccountTotals(
  orgId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const orgEvents = await db.event.findMany({
    where: { orgId },
    select: { id: true },
  });
  const eventIds = orgEvents.map((event) => event.id);

  const [totalEvents, totalParticipants, totalConnections, boothIds] =
    await Promise.all([
      Promise.resolve(eventIds.length),
      eventIds.length === 0
        ? Promise.resolve(0)
        : db.participant.count({ where: { eventId: { in: eventIds } } }),
      eventIds.length === 0
        ? Promise.resolve(0)
        : db.businessConnection.count({
            where: { eventId: { in: eventIds } },
          }),
      db.exhibitorBooth.findMany({
        where: { companyOrgId: orgId },
        select: { id: true },
      }),
    ]);

  const allBoothIds = boothIds.map((b) => b.id);
  const exhibitorEventIds =
    allBoothIds.length === 0
      ? []
      : (
          await db.exhibitorBooth.findMany({
            where: { id: { in: allBoothIds } },
            select: { eventId: true },
          })
        ).map((b) => b.eventId);

  const connectionEventIds = new Set([...eventIds, ...exhibitorEventIds]);
  const totalConnectionsAll =
    connectionEventIds.size === 0
      ? 0
      : await db.businessConnection.count({
          where: { eventId: { in: [...connectionEventIds] } },
        });

  const totalLeads =
    allBoothIds.length === 0
      ? 0
      : await db.lead.count({ where: { boothId: { in: allBoothIds } } });

  return db.organization.update({
    where: { id: orgId },
    data: {
      totalEvents,
      totalParticipants,
      totalLeads,
      totalConnections: totalConnectionsAll || totalConnections,
      eventCount: totalEvents,
    },
    select: {
      totalEvents: true,
      totalParticipants: true,
      totalLeads: true,
      totalConnections: true,
      eventCount: true,
    },
  });
}
