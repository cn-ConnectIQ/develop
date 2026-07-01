/**
 * 为 TEST1377 缺工作人员的展位补齐展商操作员
 * 用法：pnpm --filter @connectiq/database db:setup-test1377-booth-staff
 */
import {
  AccountType,
  AdminStatus,
  InviteStatus,
  OrgStaffRole,
  UserAccountStatus,
  UserRole,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";
import { boothHasStaff, verifyTest1377BoothStaff } from "./verify-test1377-booth-staff";

const SEED_PASSWORD = "ConnectIQ2024!";

/** 待审展位默认操作员（与 setup-test1377-admin-demo 保持一致） */
export const PENDING_BOOTH_OPERATORS = [
  {
    boothId: "seed-m1377-admin-booth-E06",
    code: "E-06",
    phone: "13770000006",
    name: "海岳接待",
    company: "海岳智能科技",
    orgSlug: "seed-m1377-admin-e-06",
  },
  {
    boothId: "seed-m1377-admin-booth-F11",
    code: "F-11",
    phone: "13770000011",
    name: "芯联接待",
    company: "芯联传感",
    orgSlug: "seed-m1377-admin-f-11",
  },
] as const;

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

export async function ensureExhibitorOperator(params: {
  orgId: string;
  orgSlug: string;
  company: string;
  phone: string;
  name: string;
  boothId: string;
}) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const email = phoneToEmail(params.phone);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      phone: params.phone,
      name: params.name,
      userType: UserType.ACCOUNT_ADMIN,
      passwordHash,
    },
    create: {
      email,
      phone: params.phone,
      name: params.name,
      passwordHash,
      userType: UserType.ACCOUNT_ADMIN,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      accountStatus: UserAccountStatus.COMPLETE,
      company: params.company,
    },
    create: {
      userId: user.id,
      accountStatus: UserAccountStatus.COMPLETE,
      company: params.company,
    },
  });

  await prisma.organization.update({
    where: { id: params.orgId },
    data: {
      name: params.company,
      accountType: AccountType.EXHIBITOR,
      adminStatus: AdminStatus.APPROVED,
      isVerified: true,
      ownerId: user.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { orgId: params.orgId },
  });

  await prisma.orgStaff.upsert({
    where: { orgId_userId: { orgId: params.orgId, userId: user.id } },
    update: {
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
    create: {
      orgId: params.orgId,
      userId: user.id,
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  for (const role of [UserRole.EXHIBITOR]) {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId: user.id, role, entityId: params.boothId },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({
        data: { userId: user.id, role, entityId: params.boothId },
      });
    }
  }

  await prisma.exhibitorBooth.update({
    where: { id: params.boothId },
    data: { operatorUserId: user.id },
  });

  return user;
}

export async function ensureTest1377BoothStaff() {
  const before = await verifyTest1377BoothStaff();
  const fixed: { code: string; phone: string; name: string }[] = [];

  for (const missing of before.missing) {
    const spec = PENDING_BOOTH_OPERATORS.find((row) => row.boothId === missing.id);
    if (!spec) {
      throw new Error(
        `展位 ${missing.code} (${missing.id}) 缺少工作人员，且无预设操作员配置`,
      );
    }

    const org = await prisma.organization.findUnique({
      where: { slug: spec.orgSlug },
      select: { id: true },
    });
    if (!org) {
      throw new Error(`组织不存在: ${spec.orgSlug}`);
    }

    await ensureExhibitorOperator({
      orgId: org.id,
      orgSlug: spec.orgSlug,
      company: spec.company,
      phone: spec.phone,
      name: spec.name,
      boothId: spec.boothId,
    });

    fixed.push({ code: spec.code, phone: spec.phone, name: spec.name });
  }

  const after = await verifyTest1377BoothStaff();
  return { before, after, fixed };
}

async function main() {
  const { before, after, fixed } = await ensureTest1377BoothStaff();

  console.log(`\n🔧 TEST1377 展位工作人员补齐\n`);
  if (fixed.length === 0) {
    console.log(`✅ 无需补齐，${before.booths.length} 个展位均已配置工作人员`);
    return;
  }

  for (const row of fixed) {
    console.log(`  ✓ ${row.code} → ${row.name} (${row.phone})`);
  }

  if (after.missing.length > 0) {
    console.error(`\n✗ 仍有 ${after.missing.length} 个展位缺少工作人员`);
    process.exit(1);
  }

  console.log(`\n✅ 全部 ${after.booths.length} 个展位均至少有一名工作人员`);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").includes("setup-test1377-booth-staff");

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
