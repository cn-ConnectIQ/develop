import {
  InviteStatus,
  OrgStaffRole,
  prisma,
} from "@connectiq/database";
import {
  createSuccessResponse,
  requireAuthSession,
  unauthorized,
  withErrorHandler,
} from "@/lib/api-auth";

export const GET = withErrorHandler(async () => {
  const session = await requireAuthSession();
  if (!session) return unauthorized();

  const staffRoles = await prisma.orgStaff.findMany({
    where: {
      userId: session.user.id,
      role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
      status: InviteStatus.ACCEPTED,
    },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          accountType: true,
          adminStatus: true,
          memberCount: true,
          eventCount: true,
          isVerified: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return createSuccessResponse(
    staffRoles.map((s) => ({
      id: s.org.id,
      name: s.org.name,
      slug: s.org.slug,
      logoUrl: s.org.logoUrl,
      accountType: s.org.accountType,
      adminStatus: s.org.adminStatus,
      memberCount: s.org.memberCount,
      eventCount: s.org.eventCount,
      isVerified: s.org.isVerified,
      myRole: s.role,
      isActive: s.org.id === session.user.activeOrgId,
    })),
  );
});
