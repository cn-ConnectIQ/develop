import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import {
  InviteStatus,
  OrgStaffRole,
  UserType as PrismaUserType,
} from "@connectiq/database";
import { prisma, PrismaUserRole } from "@connectiq/database";
import type { UserRole as AppUserRole } from "@connectiq/types";
import { cacheDel, cacheGet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";

type OwnedOrgSummary = NonNullable<Session["user"]["ownedOrgs"]>[number];

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function resolveUserType(
  userType: PrismaUserType,
  assignments: { role: PrismaUserRole }[],
): PrismaUserType {
  if (userType !== PrismaUserType.END_USER) return userType;

  if (
    assignments.some((item) => item.role === PrismaUserRole.PLATFORM_ADMIN)
  ) {
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

function toOwnedOrgSummary(org: {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  accountType: string;
  adminStatus: string;
}): OwnedOrgSummary {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo_url: org.logoUrl,
    account_type: org.accountType,
    admin_status: org.adminStatus,
  };
}

function toLegacyRole(
  userType: PrismaUserType,
  activeOrgType: string | null | undefined,
): AppUserRole {
  if (userType === PrismaUserType.PLATFORM_ADMIN) {
    return PrismaUserRole.PLATFORM_ADMIN as AppUserRole;
  }
  if (userType === PrismaUserType.ACCOUNT_ADMIN) {
    switch (activeOrgType) {
      case "EXPO_ORGANIZER":
        return PrismaUserRole.EXPO_ORGANIZER as AppUserRole;
      case "EXHIBITOR":
        return PrismaUserRole.EXHIBITOR as AppUserRole;
      case "ORGANIZATION":
      case "CONFERENCE_ORGANIZER":
      default:
        return PrismaUserRole.ORGANIZER as AppUserRole;
    }
  }
  return PrismaUserRole.ORGANIZER as AppUserRole;
}

function syncLegacyTokenFields(token: {
  userType?: PrismaUserType;
  activeOrgType?: string | null;
  activeOrgId?: string | null;
  role?: AppUserRole;
  entityId?: string | null;
}) {
  const userType = token.userType ?? PrismaUserType.END_USER;
  token.role = toLegacyRole(userType, token.activeOrgType);
  token.entityId = token.activeOrgId ?? null;
}

/** @deprecated 旧角色检查，迁移完成后移除 */
export function hasAnyRole(
  role: AppUserRole,
  allowedRoles: AppUserRole[],
): boolean {
  return allowedRoles.includes(role);
}

async function hydrateAccountAdminToken(userId: string) {
  const staffRoles = await prisma.orgStaff.findMany({
    where: {
      userId,
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
        },
      },
    },
  });

  const ownedOrgs = staffRoles.map((s) => toOwnedOrgSummary(s.org));

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeOrgId: true },
  });

  const activeOrg =
    ownedOrgs.find((o) => o.id === dbUser?.activeOrgId) ||
    ownedOrgs.find((o) => o.admin_status === "APPROVED") ||
    ownedOrgs[0] ||
    null;

  return {
    ownedOrgs,
    activeOrgId: activeOrg?.id ?? null,
    activeOrgSlug: activeOrg?.slug ?? null,
    activeOrgType: activeOrg?.account_type ?? null,
    activeAdminStatus: activeOrg?.admin_status ?? null,
  };
}

async function loadUserType(userId: string): Promise<PrismaUserType | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleAssignments: true },
  });
  if (!user) return null;
  return resolveUserType(user.userType, user.roleAssignments);
}

function toSessionUser(
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
  },
  userType: PrismaUserType,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    userType,
  };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      id: "phone",
      name: "phone",
      credentials: {
        phone: { label: "手机号", type: "text" },
        code: { label: "验证码", type: "text" },
      },
      async authorize(credentials) {
        const phone = credentials?.phone?.trim();
        const code = credentials?.code?.trim();

        if (!phone || !code || !/^1[3-9]\d{9}$/.test(phone)) return null;

        const stored = await cacheGet(smsVerifyKey(phone));
        if (!stored || stored !== code) return null;

        await cacheDel(smsVerifyKey(phone));

        let user = await prisma.user.findFirst({
          where: { phone },
          include: { roleAssignments: true },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              phone,
              email: phoneToEmail(phone),
              passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
              name: `用户${phone.slice(-4)}`,
              userType: PrismaUserType.END_USER,
              roleAssignments: {
                create: { role: PrismaUserRole.ORGANIZER },
              },
            },
            include: { roleAssignments: true },
          });
        }

        const userType = resolveUserType(user.userType, user.roleAssignments);
        return toSessionUser(user, userType);
      },
    }),
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password?.trim();

        if (!email || !password) return null;

        let user = await prisma.user.findUnique({
          where: { email },
          include: { roleAssignments: true },
        });

        // 兼容仅 phone 匹配、email 字段不一致的历史数据
        if (!user) {
          const phoneMatch = email.match(
            /^(1[3-9]\d{9})@phone\.connectiq\.local$/,
          );
          if (phoneMatch) {
            user = await prisma.user.findFirst({
              where: { phone: phoneMatch[1] },
              include: { roleAssignments: true },
            });
          }
        }

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const userType = resolveUserType(user.userType, user.roleAssignments);
        return toSessionUser(user, userType);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          token.userType = user.userType as PrismaUserType;
          token.userId = user.id;
          token.phone = user.phone ?? null;

          if (user.userType === PrismaUserType.ACCOUNT_ADMIN) {
            const orgSession = await hydrateAccountAdminToken(user.id);
            token.ownedOrgs = orgSession.ownedOrgs;
            token.activeOrgId = orgSession.activeOrgId;
            token.activeOrgSlug = orgSession.activeOrgSlug;
            token.activeOrgType = orgSession.activeOrgType;
            token.activeAdminStatus = orgSession.activeAdminStatus;
          }
        } else if (
          trigger === "update" &&
          token.sub &&
          token.userType === PrismaUserType.ACCOUNT_ADMIN
        ) {
          const orgSession = await hydrateAccountAdminToken(token.sub);
          token.ownedOrgs = orgSession.ownedOrgs;
          token.activeOrgId = orgSession.activeOrgId;
          token.activeOrgSlug = orgSession.activeOrgSlug;
          token.activeOrgType = orgSession.activeOrgType;
          token.activeAdminStatus = orgSession.activeAdminStatus;
        } else if (token.sub && !token.userType) {
          const userType = await loadUserType(token.sub);
          if (userType) {
            token.userType = userType;
          }
        }
      } catch (error) {
        console.error("[auth] jwt callback failed:", error);
        if (user) {
          token.userType = user.userType as PrismaUserType;
          token.userId = user.id;
          token.phone = user.phone ?? null;
          if (user.userType === PrismaUserType.ACCOUNT_ADMIN) {
            try {
              const orgSession = await hydrateAccountAdminToken(user.id);
              token.ownedOrgs = orgSession.ownedOrgs;
              token.activeOrgId = orgSession.activeOrgId;
              token.activeOrgSlug = orgSession.activeOrgSlug;
              token.activeOrgType = orgSession.activeOrgType;
              token.activeAdminStatus = orgSession.activeAdminStatus;
            } catch (hydrateError) {
              console.error("[auth] org hydrate fallback failed:", hydrateError);
            }
          }
        }
      }

      syncLegacyTokenFields(token);
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.userId as string) ?? token.sub ?? "";
      session.user.userType = token.userType as Session["user"]["userType"];
      session.user.activeOrgId = token.activeOrgId as string | null;
      session.user.activeOrgSlug = token.activeOrgSlug as string | null;
      session.user.activeOrgType = token.activeOrgType as string | null;
      session.user.activeAdminStatus = token.activeAdminStatus as string | null;
      session.user.ownedOrgs = token.ownedOrgs as Session["user"]["ownedOrgs"];
      session.user.phone = (token.phone as string | null) ?? null;

      const userType =
        (token.userType as PrismaUserType) ?? PrismaUserType.END_USER;
      session.user.role = toLegacyRole(
        userType,
        token.activeOrgType as string | null,
      );
      session.user.entityId = (token.activeOrgId as string | null) ?? null;
      session.user.hasPlatformAdmin =
        userType === PrismaUserType.PLATFORM_ADMIN;

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
