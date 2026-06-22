import { PrismaUserRole, type Prisma } from "@connectiq/database";

/** 组织审核通过后授予的全局管理角色 */
export const ORG_ADMIN_ROLES = [
  PrismaUserRole.ORGANIZER,
  PrismaUserRole.EXPO_ORGANIZER,
  PrismaUserRole.EXHIBITOR,
] as const;

export async function grantOrgAdminRoles(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  for (const role of ORG_ADMIN_ROLES) {
    const existing = await tx.userRoleAssignment.findFirst({
      where: { userId, role, entityId: null },
    });
    if (!existing) {
      await tx.userRoleAssignment.create({ data: { userId, role } });
    }
  }
}
