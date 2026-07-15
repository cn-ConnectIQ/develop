import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import {
  UserAccountStatus,
  UserType,
  prisma,
  PrismaUserRole,
} from "@connectiq/database";

export class PlatformAdminError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "FORBIDDEN"
      | "VALIDATION"
      | "LAST_ADMIN",
  ) {
    super(message);
    this.name = "PlatformAdminError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateTempPassword(length = 12) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

async function countPlatformAdmins() {
  return prisma.user.count({ where: { userType: UserType.PLATFORM_ADMIN } });
}

async function ensurePlatformRole(userId: string) {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { userId, role: PrismaUserRole.PLATFORM_ADMIN },
  });
  if (!existing) {
    await prisma.userRoleAssignment.create({
      data: { userId, role: PrismaUserRole.PLATFORM_ADMIN },
    });
  }
}

export async function listPlatformAdmins() {
  const users = await prisma.user.findMany({
    where: { userType: UserType.PLATFORM_ADMIN },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
}

/**
 * 新建平台管理员；若邮箱已存在则提升为平台管理员（并可选重置初始密码）。
 * 返回一次性明文密码，仅供运维当面告知对方。
 */
export async function upsertPlatformAdmin(input: {
  name: string;
  email: string;
  phone?: string | null;
  password?: string | null;
  actorUserId: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const phone = input.phone?.replace(/\D/g, "").trim() || null;

  if (!name) {
    throw new PlatformAdminError("请填写姓名", "VALIDATION");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PlatformAdminError("邮箱格式不正确", "VALIDATION");
  }
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    throw new PlatformAdminError("手机号格式不正确", "VALIDATION");
  }

  const plainPassword =
    input.password?.trim() && input.password.trim().length >= 8
      ? input.password.trim()
      : generateTempPassword();
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.userType === UserType.PLATFORM_ADMIN) {
      throw new PlatformAdminError("该邮箱已是平台管理员", "CONFLICT");
    }
    if (phone) {
      const phoneTaken = await prisma.user.findFirst({
        where: { phone, id: { not: existing.id } },
        select: { id: true },
      });
      if (phoneTaken) {
        throw new PlatformAdminError("该手机号已被其他账号占用", "CONFLICT");
      }
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        phone: phone ?? existing.phone,
        passwordHash,
        userType: UserType.PLATFORM_ADMIN,
      },
    });
    await ensurePlatformRole(existing.id);
    await prisma.userProfile.upsert({
      where: { userId: existing.id },
      update: { accountStatus: UserAccountStatus.COMPLETE },
      create: {
        userId: existing.id,
        accountStatus: UserAccountStatus.COMPLETE,
      },
    });

    return {
      mode: "promoted" as const,
      userId: existing.id,
      email,
      name,
      phone: phone ?? existing.phone,
      initialPassword: plainPassword,
      actorUserId: input.actorUserId,
    };
  }

  if (phone) {
    const phoneTaken = await prisma.user.findFirst({
      where: { phone },
      select: { id: true },
    });
    if (phoneTaken) {
      throw new PlatformAdminError("该手机号已被其他账号占用", "CONFLICT");
    }
  }

  const created = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      passwordHash,
      userType: UserType.PLATFORM_ADMIN,
      roleAssignments: {
        create: { role: PrismaUserRole.PLATFORM_ADMIN },
      },
      profile: {
        create: { accountStatus: UserAccountStatus.COMPLETE },
      },
    },
  });

  return {
    mode: "created" as const,
    userId: created.id,
    email,
    name,
    phone,
    initialPassword: plainPassword,
    actorUserId: input.actorUserId,
  };
}

export async function revokePlatformAdmin(input: {
  userId: string;
  actorUserId: string;
}) {
  if (input.userId === input.actorUserId) {
    throw new PlatformAdminError("不能撤销自己的平台管理员权限", "FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, userType: true, orgId: true },
  });
  if (!target || target.userType !== UserType.PLATFORM_ADMIN) {
    throw new PlatformAdminError("目标不是平台管理员", "NOT_FOUND");
  }

  const total = await countPlatformAdmins();
  if (total <= 1) {
    throw new PlatformAdminError("至少保留一名平台管理员", "LAST_ADMIN");
  }

  // 若仍绑定组织，降回账号管理员；否则回终端用户
  const nextType = target.orgId
    ? UserType.ACCOUNT_ADMIN
    : UserType.END_USER;

  await prisma.$transaction([
    prisma.userRoleAssignment.deleteMany({
      where: { userId: target.id, role: PrismaUserRole.PLATFORM_ADMIN },
    }),
    prisma.user.update({
      where: { id: target.id },
      data: { userType: nextType },
    }),
  ]);

  return { userId: target.id, nextType };
}
