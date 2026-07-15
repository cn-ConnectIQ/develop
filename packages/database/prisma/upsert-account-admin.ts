/**
 * 将账号管理员（统一组织）设为 milo@bagevent.cn / BagEvent1001（幂等）
 * 用法: pnpm --filter @connectiq/database exec tsx prisma/upsert-account-admin.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  UserAccountStatus,
  UserType,
} from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "../../apps/web/.env.local") });

const { prisma } = await import("../src/index");

const EMAIL = "milo@bagevent.cn";
const PHONE = "13800000008";
const LEGACY_EMAIL = "13800000008@phone.connectiq.local";
const NAME = "陈主编";
const PASSWORD = "BagEvent1001";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // 若 milo@ 仍是平台管理员，先挪走平台邮箱
  const milo = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (milo?.userType === UserType.PLATFORM_ADMIN) {
    const platformEmail = "platform@bagevent.cn";
    const taken = await prisma.user.findUnique({ where: { email: platformEmail } });
    if (!taken) {
      await prisma.user.update({
        where: { id: milo.id },
        data: { email: platformEmail },
      });
      console.log(`→ 原平台管理员 ${EMAIL} → ${platformEmail}`);
    } else if (taken.id !== milo.id) {
      // milo 账号改绑到账号管理员角色，平台侧已有独立账号
      await prisma.user.update({
        where: { id: milo.id },
        data: {
          phone: PHONE,
          name: NAME,
          passwordHash,
          userType: UserType.ACCOUNT_ADMIN,
        },
      });
      await prisma.userProfile.upsert({
        where: { userId: milo.id },
        update: { accountStatus: UserAccountStatus.COMPLETE },
        create: {
          userId: milo.id,
          accountStatus: UserAccountStatus.COMPLETE,
        },
      });
      console.log("✓ 已将 milo@bagevent.cn 设为账号管理员");
      console.log(`  邮箱: ${EMAIL}`);
      console.log(`  密码: ${PASSWORD}`);
      console.log(`  手机: ${PHONE}`);
      console.log(`  userId: ${milo.id}`);
      return;
    }
  }

  const byPhone = await prisma.user.findFirst({ where: { phone: PHONE } });
  const byLegacy = await prisma.user.findUnique({
    where: { email: LEGACY_EMAIL },
  });
  const byEmail = await prisma.user.findUnique({ where: { email: EMAIL } });

  let userId: string;

  if (byEmail && byEmail.userType !== UserType.PLATFORM_ADMIN) {
    userId = byEmail.id;
    await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        phone: PHONE,
        name: NAME,
        passwordHash,
        userType: UserType.ACCOUNT_ADMIN,
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
        userType: UserType.ACCOUNT_ADMIN,
      },
    });
  } else if (byLegacy) {
    userId = byLegacy.id;
    await prisma.user.update({
      where: { id: byLegacy.id },
      data: {
        email: EMAIL,
        phone: PHONE,
        name: NAME,
        passwordHash,
        userType: UserType.ACCOUNT_ADMIN,
      },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        phone: PHONE,
        name: NAME,
        passwordHash,
        userType: UserType.ACCOUNT_ADMIN,
      },
    });
    userId = created.id;
  }

  await prisma.userProfile.upsert({
    where: { userId },
    update: { accountStatus: UserAccountStatus.COMPLETE },
    create: {
      userId,
      accountStatus: UserAccountStatus.COMPLETE,
    },
  });

  console.log("✓ 账号管理员已就绪");
  console.log(`  邮箱: ${EMAIL}`);
  console.log(`  密码: ${PASSWORD}`);
  console.log(`  手机: ${PHONE}`);
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
