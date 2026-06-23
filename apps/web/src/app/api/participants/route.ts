import { EventType, prisma, PrismaUserRole } from "@connectiq/database";
import { jsonSuccess, withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (_request, { session }) => {
  const where =
    session.user.role === PrismaUserRole.PLATFORM_ADMIN
      ? {}
      : session.user.role === PrismaUserRole.ORGANIZER
        ? session.user.activeOrgId
          ? { event: { orgId: session.user.activeOrgId } }
          : { event: { organizerId: session.user.id } }
        : session.user.role === PrismaUserRole.EXPO_ORGANIZER
          ? session.user.activeOrgId
            ? {
                event: {
                  orgId: session.user.activeOrgId,
                  type: EventType.EXPO,
                },
              }
            : {
                event: {
                  organizerId: session.user.id,
                  type: EventType.EXPO,
                },
              }
          : session.user.role === PrismaUserRole.EXHIBITOR && session.user.entityId
            ? {
                event: {
                  booths: { some: { id: session.user.entityId } },
                },
              }
            : { id: "__none__" };

  const participants = await prisma.participant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      eventId: true,
      createdAt: true,
    },
  });

  return jsonSuccess(participants, 200, { total: participants.length });
});
