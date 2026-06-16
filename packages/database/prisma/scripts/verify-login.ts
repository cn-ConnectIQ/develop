import bcrypt from "bcryptjs";
import {
  InviteStatus,
  OrgStaffRole,
  UserType as PrismaUserType,
} from "@connectiq/database";
import { prisma, PrismaUserRole } from "@connectiq/database";

function resolveUserType(
  userType: PrismaUserType,
  assignments: { role: PrismaUserRole }[],
): PrismaUserType {
  if (userType !== PrismaUserType.END_USER) return userType;
  if (assignments.some((item) => item.role === PrismaUserRole.PLATFORM_ADMIN)) {
    return PrismaUserType.PLATFORM_ADMIN;
  }
  if (
    assignments.some((item) =>
      (
        [
          PrismaUserRole.ORGANIZER,
          PrismaUserRole.EXPO_ORGANIZER,
          PrismaUserRole.EXHIBITOR,
        ] as PrismaUserRole[]
      ).includes(item.role),
    )
  ) {
    return PrismaUserType.ACCOUNT_ADMIN;
  }
  return PrismaUserType.END_USER;
}

const email = "13800000001@phone.connectiq.local";
const password = "ConnectIQ2024!";

const user = await prisma.user.findUnique({
  where: { email: email.trim().toLowerCase() },
  include: { roleAssignments: true },
});

if (!user) {
  console.log("FAIL: user not found");
  process.exit(1);
}

const valid = await bcrypt.compare(password.trim(), user.passwordHash);
console.log("password valid:", valid);
const userType = resolveUserType(user.userType, user.roleAssignments);
console.log("resolved userType:", userType);

if (userType === PrismaUserType.ACCOUNT_ADMIN) {
  const staffRoles = await prisma.orgStaff.findMany({
    where: {
      userId: user.id,
      role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
      status: InviteStatus.ACCEPTED,
    },
  });
  console.log("org staff count:", staffRoles.length);
}

await prisma.$disconnect();
console.log("authorize simulation OK");
