/**
 * 将平台管理员设为 milo@bagevent.cn / BagEvent1001（幂等）
 * 用法: pnpm --filter @connectiq/database db:upsert-platform-admin
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  UserAccountStatus,
  UserRole,
  UserType,
} from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "../../apps/web/.env.local") });

const { prisma } = await import("../src/index");

const EMAIL = "milo@bagevent.cn";
const PHONE = "13800000001";
const NAME = "Milo";
const PASSWORD = "BagEvent1001";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const byPhone = await prisma.user.findFirst({ where: { phone: PHONE } });
  const byEmail = await prisma.user.findUnique({ where: { email: EMAIL } });

  let userId: string;

  if (byEmail) {
    userId = byEmail.id;
    await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        phone: PHONE,
        name: NAME,
        passwordHash,
        userType: UserType.PLATFORM_ADMIN,
      },
    });
  } else if (byPhone) {
    userId = byPhone.id;
    await prisma.user.update({
      where: { id: byPhone.id },
      data: {
        email: EMAIL,
        name: NAME,
        passwordHash,
        userType: UserType.PLATFORM_ADMIN,
      },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        phone: PHONE,
        name: NAME,
        passwordHash,
        userType: UserType.PLATFORM_ADMIN,
      },
    });
    userId = created.id;
  }

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      accountStatus: UserAccountStatus.COMPLETE,
      company: "玖莅",
      industry: "活动科技",
    },
    create: {
      userId,
      accountStatus: UserAccountStatus.COMPLETE,
      company: "玖莅",
      industry: "活动科技",
    },
  });

  const role = await prisma.userRoleAssignment.findFirst({
    where: { userId, role: UserRole.PLATFORM_ADMIN },
  });
  if (!role) {
    await prisma.userRoleAssignment.create({
      data: { userId, role: UserRole.PLATFORM_ADMIN },
    });
  }

  console.log("✓ 平台管理员已就绪");
  console.log(`  邮箱: ${EMAIL}`);
  console.log(`  密码: ${PASSWORD}`);
  console.log(`  手机: ${PHONE}（仍可用手机验证码登录）`);
  console.log(`  userId: ${userId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
