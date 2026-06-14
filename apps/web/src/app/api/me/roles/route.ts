import { prisma } from "@connectiq/database";
import { UserRole } from "@connectiq/types";
import {
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { getRoleHomePath, ROLE_META } from "@/lib/role-utils";

export const GET = withErrorHandler(async () => {
  const { user } = await requireAuth();

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const eventIds = assignments
    .filter(
      (a) =>
        a.entityId &&
        (a.role === UserRole.ORGANIZER ||
          a.role === UserRole.EXPO_ORGANIZER),
    )
    .map((a) => a.entityId!);

  const boothIds = assignments
    .filter((a) => a.entityId && a.role === UserRole.EXHIBITOR)
    .map((a) => a.entityId!);

  const [events, booths] = await Promise.all([
    eventIds.length
      ? prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true, type: true },
        })
      : [],
    boothIds.length
      ? prisma.booth.findMany({
          where: { id: { in: boothIds } },
          select: {
            id: true,
            name: true,
            code: true,
            event: { select: { name: true } },
          },
        })
      : [],
  ]);

  const eventMap = new Map(events.map((e) => [e.id, e]));
  const boothMap = new Map(booths.map((b) => [b.id, b]));

  const roles = assignments.map((assignment) => {
    const meta = ROLE_META[assignment.role as UserRole];
    let entityName: string | null = null;

    if (assignment.entityId) {
      if (
        assignment.role === UserRole.ORGANIZER ||
        assignment.role === UserRole.EXPO_ORGANIZER
      ) {
        entityName = eventMap.get(assignment.entityId)?.name ?? null;
      } else if (assignment.role === UserRole.EXHIBITOR) {
        const booth = boothMap.get(assignment.entityId);
        entityName = booth
          ? `${booth.code} · ${booth.event.name}`
          : null;
      }
    }

    return {
      role: assignment.role,
      entityId: assignment.entityId,
      entityName,
      emoji: meta.emoji,
      label: meta.label,
      colorClass: meta.colorClass,
      homePath: getRoleHomePath(
        assignment.role as UserRole,
        assignment.entityId,
      ),
      isActive:
        user.role === assignment.role &&
        user.entityId === assignment.entityId,
    };
  });

  return createSuccessResponse({
    roles,
    activeRole: user.role,
    activeEntityId: user.entityId,
  });
});
