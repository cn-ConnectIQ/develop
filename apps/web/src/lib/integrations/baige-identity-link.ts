import {
  AdminStatus,
  InviteStatus,
  OrgStaffRole,
  PrismaUserType,
  prisma,
} from "@connectiq/database";
import bcrypt from "bcryptjs";
import { grantOrgAdminRoles } from "@/lib/org-admin-roles";
import { BaigeConnectionError } from "@/lib/integrations/baige-connection-service";
import { slugify } from "@/lib/event-utils";

export const BAIGE_IDENTITY_PROVIDER = "baige";

export type BaigeIdentityInput = {
  baigeUserId?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  /** 组织显示名；缺省用邮箱 @ 前 / 手机号 */
  orgName?: string | null;
};

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function normalizeEmail(email?: string | null) {
  const v = email?.trim().toLowerCase();
  return v && v.includes("@") ? v : null;
}

/** 归一化中国大陆手机号：去空格/横线，剥 +86 / 0086 / 86 前缀 */
export function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  let v = phone.trim().replace(/[\s-]/g, "");
  if (v.startsWith("+86")) v = v.slice(3);
  else if (v.startsWith("0086")) v = v.slice(4);
  else if (/^86[1][3-9]\d{9}$/.test(v)) v = v.slice(2);
  return /^1[3-9]\d{9}$/.test(v) ? v : null;
}

/** 组织名：显式 orgName → 邮箱 @ 前 → 手机号 → 联系人姓名 → 百格组织后缀 */
export function deriveBaigeOrgDisplayName(input: {
  orgName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  baigeOrgId: string;
}): string {
  const explicit = input.orgName?.trim();
  if (explicit) return explicit.slice(0, 64);

  const email = normalizeEmail(input.email);
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local.slice(0, 64);
  }

  const phone = normalizePhone(input.phone);
  if (phone) return phone;

  const person = input.name?.trim();
  if (person) return person.slice(0, 64);

  return `百格组织-${input.baigeOrgId.trim().slice(-8)}`;
}

async function resolveUniqueOrgSlug(baseName: string): Promise<string> {
  let slug = slugify(baseName).slice(0, 48) || `baige-${Date.now().toString(36)}`;
  for (let i = 0; i < 12; i++) {
    const exists = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
    slug = `${slugify(baseName).slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `baige-${Date.now().toString(36)}`;
}

/**
 * 按邮箱 / 手机 / baigeUserId 查找或创建玖莅 User，
 * 并写入 UserIdentity(provider=baige)。
 */
export async function resolveOrCreateUserFromBaigeIdentity(
  input: BaigeIdentityInput,
) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const baigeUserId = input.baigeUserId?.trim() || null;

  if (!email && !phone && !baigeUserId) {
    throw new BaigeConnectionError(
      "请提供邮箱、手机号或 baigeUserId",
      "VALIDATION",
    );
  }

  let userId: string | null = null;

  if (baigeUserId) {
    const byIdentity = await prisma.userIdentity.findFirst({
      where: { provider: BAIGE_IDENTITY_PROVIDER, value: baigeUserId },
      select: { userId: true },
    });
    userId = byIdentity?.userId ?? null;
  }

  if (!userId && email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = byEmail?.id ?? null;
  }

  if (!userId && phone) {
    const byPhone = await prisma.user.findFirst({
      where: { phone },
      select: { id: true },
    });
    userId = byPhone?.id ?? null;
  }

  if (!userId) {
    const displayName =
      input.name?.trim() ||
      (phone ? `用户${phone.slice(-4)}` : email?.split("@")[0]) ||
      "百格用户";
    const created = await prisma.user.create({
      data: {
        email: email ?? (phone ? phoneToEmail(phone) : `baige_${Date.now()}@baige.9li.local`),
        phone,
        name: displayName,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
        userType: PrismaUserType.ACCOUNT_ADMIN,
      },
      select: { id: true },
    });
    userId = created.id;
  } else {
    const patch: {
      phone?: string;
      name?: string;
      email?: string;
      userType?: PrismaUserType;
    } = {};
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        name: true,
        email: true,
        userType: true,
      },
    });
    if (!existing) {
      throw new BaigeConnectionError("用户不存在", "VALIDATION");
    }
    if (phone && !existing.phone) patch.phone = phone;
    if (input.name?.trim() && existing.name.startsWith("用户")) {
      patch.name = input.name.trim();
    }
    // 占位邮箱可升级为真实邮箱（无冲突时）
    if (
      email &&
      existing.email.endsWith("@phone.connectiq.local") &&
      existing.email !== email
    ) {
      const taken = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!taken) patch.email = email;
    }
    if (existing.userType === PrismaUserType.END_USER) {
      patch.userType = PrismaUserType.ACCOUNT_ADMIN;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: patch });
    }
  }

  if (baigeUserId) {
    const conflict = await prisma.userIdentity.findFirst({
      where: {
        provider: BAIGE_IDENTITY_PROVIDER,
        value: baigeUserId,
        NOT: { userId },
      },
      select: { id: true },
    });
    if (conflict) {
      await prisma.userIdentity.delete({ where: { id: conflict.id } });
    }
    await prisma.userIdentity.upsert({
      where: {
        userId_provider: {
          userId,
          provider: BAIGE_IDENTITY_PROVIDER,
        },
      },
      create: {
        userId,
        provider: BAIGE_IDENTITY_PROVIDER,
        value: baigeUserId,
        verified: true,
      },
      update: { value: baigeUserId, verified: true },
    });
  }

  return userId;
}

/**
 * 确保用户是该组织的已接受管理员（可进管理端）。
 * 默认 ADMIN；已是 OWNER 不降级。
 */
export async function ensureBaigeUserOrgAdminAccess(input: {
  userId: string;
  orgId: string;
  invitedByUserId?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        userType: PrismaUserType.ACCOUNT_ADMIN,
        orgId: input.orgId,
      },
    });

    const existing = await tx.orgStaff.findUnique({
      where: {
        orgId_userId: { orgId: input.orgId, userId: input.userId },
      },
    });

    if (!existing) {
      await tx.orgStaff.create({
        data: {
          orgId: input.orgId,
          userId: input.userId,
          role: OrgStaffRole.ADMIN,
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
          invitedBy: input.invitedByUserId ?? null,
        },
      });
    } else if (existing.status !== InviteStatus.ACCEPTED) {
      await tx.orgStaff.update({
        where: { id: existing.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
          role:
            existing.role === OrgStaffRole.OWNER
              ? OrgStaffRole.OWNER
              : OrgStaffRole.ADMIN,
        },
      });
    } else if (
      existing.role === OrgStaffRole.VIEWER ||
      existing.role === OrgStaffRole.OPERATOR
    ) {
      await tx.orgStaff.update({
        where: { id: existing.id },
        data: { role: OrgStaffRole.ADMIN },
      });
    }

    await grantOrgAdminRoles(tx, input.userId);
  });
}

/** 授权绑定完成后：身份打通 + 组织管理员权限 */
export async function linkBaigeIdentityToOrg(input: {
  orgId: string;
  identity: BaigeIdentityInput;
  invitedByUserId?: string | null;
}) {
  const userId = await resolveOrCreateUserFromBaigeIdentity(input.identity);
  await ensureBaigeUserOrgAdminAccess({
    userId,
    orgId: input.orgId,
    invitedByUserId: input.invitedByUserId,
  });
  return userId;
}

/**
 * 百格首次授权：无玖莅组织时自动创建 User + Organization（TRIAL，可进管理端）
 * 组织名默认 = 邮箱 @ 前 / 手机号。
 */
export async function provisionBaigeOrgAndOwner(input: {
  baigeOrgId: string;
  identity: BaigeIdentityInput;
}): Promise<{ orgId: string; userId: string; orgCreated: boolean }> {
  const email = normalizeEmail(input.identity.email);
  const phone = normalizePhone(input.identity.phone);
  const baigeUserId = input.identity.baigeUserId?.trim() || null;
  // 自动开户严格要求：(email|phone) + baigeUserId
  if (!baigeUserId || (!email && !phone)) {
    throw new BaigeConnectionError(
      "首次自动开户需提供 baigeUserId，以及邮箱或手机号之一",
      "VALIDATION",
    );
  }

  const userId = await resolveOrCreateUserFromBaigeIdentity(input.identity);

  // 用户已有可用组织：复用（仍会在外层写 PartnerConnection）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      orgId: true,
      email: true,
      phone: true,
      name: true,
      ownedOrg: { select: { id: true, adminStatus: true } },
    },
  });

  if (user?.orgId) {
    const staff = await prisma.orgStaff.findFirst({
      where: {
        userId,
        orgId: user.orgId,
        status: InviteStatus.ACCEPTED,
      },
      select: { id: true },
    });
    if (staff) {
      await ensureBaigeUserOrgAdminAccess({ userId, orgId: user.orgId });
      return { orgId: user.orgId, userId, orgCreated: false };
    }
  }

  if (user?.ownedOrg?.id) {
    await ensureBaigeUserOrgAdminAccess({
      userId,
      orgId: user.ownedOrg.id,
    });
    return { orgId: user.ownedOrg.id, userId, orgCreated: false };
  }

  const orgName = deriveBaigeOrgDisplayName({
    orgName: input.identity.orgName,
    name: input.identity.name,
    email: input.identity.email,
    phone: input.identity.phone,
    baigeOrgId: input.baigeOrgId,
  });
  const slug = await resolveUniqueOrgSlug(orgName);
  const contactEmail =
    email ?? (phone ? phoneToEmail(phone) : null);

  const org = await prisma.$transaction(async (tx) => {
    const existingOwnerOrg = await tx.organization.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    const created = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        contactEmail,
        adminStatus: AdminStatus.TRIAL,
        isVerified: false,
        ownerId: existingOwnerOrg ? undefined : userId,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        userType: PrismaUserType.ACCOUNT_ADMIN,
        orgId: created.id,
      },
    });

    await tx.orgStaff.create({
      data: {
        orgId: created.id,
        userId,
        role: OrgStaffRole.OWNER,
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await grantOrgAdminRoles(tx, userId);
    return created;
  });

  return { orgId: org.id, userId, orgCreated: true };
}
