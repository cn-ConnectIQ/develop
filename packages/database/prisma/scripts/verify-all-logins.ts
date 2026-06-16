import bcrypt from "bcryptjs";
import {
  InviteStatus,
  OrgStaffRole,
  UserType as PrismaUserType,
} from "@connectiq/database";
import { prisma, PrismaUserRole } from "@connectiq/database";

const PASSWORD = "ConnectIQ2024!";

const ACCOUNTS = [
  { phone: "13800000001", label: "平台管理员", expectType: PrismaUserType.PLATFORM_ADMIN },
  { phone: "13800000002", label: "会议主办方/李经理", expectType: PrismaUserType.ACCOUNT_ADMIN },
  { phone: "13800000003", label: "展览主办方", expectType: PrismaUserType.ACCOUNT_ADMIN },
  { phone: "13800000004", label: "参展商", expectType: PrismaUserType.ACCOUNT_ADMIN },
] as const;

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

async function verifyAccount(phone: string, label: string, expectType: PrismaUserType) {
  const email = `${phone}@phone.connectiq.local`;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    include: { roleAssignments: true },
  });

  if (!user) {
    console.log(`❌ ${phone} ${label}: 用户不存在`);
    return false;
  }

  const passwordOk = await bcrypt.compare(PASSWORD, user.passwordHash);
  const resolvedType = resolveUserType(user.userType, user.roleAssignments);
  const typeOk = resolvedType === expectType;

  let orgOk = true;
  let orgDetail = "";
  if (expectType === PrismaUserType.ACCOUNT_ADMIN) {
    const staff = await prisma.orgStaff.findMany({
      where: {
        userId: user.id,
        role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
        status: InviteStatus.ACCEPTED,
      },
      include: {
        org: {
          select: {
            slug: true,
            adminStatus: true,
            accountType: true,
          },
        },
      },
    });
    const approved = staff.filter((s) => s.org.adminStatus === "APPROVED");
    orgOk = approved.length > 0;
    orgDetail = staff
      .map((s) => `${s.org.slug}(${s.org.accountType},${s.org.adminStatus})`)
      .join("; ");
  }

  const ok = passwordOk && typeOk && orgOk;
  const icon = ok ? "✅" : "❌";
  console.log(
    `${icon} ${phone} ${label}`,
    `\n   email: ${user.email}`,
    `\n   password: ${passwordOk ? "OK" : "FAIL"}`,
    `\n   userType: ${user.userType} → resolved ${resolvedType}${typeOk ? "" : " (expected " + expectType + ")"}`,
    `\n   activeOrgId: ${user.activeOrgId ?? "null"}`,
    orgDetail ? `\n   orgs: ${orgDetail}` : "",
    orgOk ? "" : "\n   org staff: 无已审核组织",
  );
  return ok;
}

console.log("ConnectIQ 测试账号登录数据校验\n");
console.log(`密码: ${PASSWORD}\n`);

let allOk = true;
for (const account of ACCOUNTS) {
  const ok = await verifyAccount(account.phone, account.label, account.expectType);
  allOk = allOk && ok;
  console.log("");
}

await prisma.$disconnect();
process.exit(allOk ? 0 : 1);
