import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import {
  AccountType as PrismaAccountType,
  AdminStatus as PrismaAdminStatus,
  UserType as PrismaUserType,
} from "@connectiq/database";
import { prisma, PrismaUserRole } from "@connectiq/database";
import type { UserRole as AppUserRole } from "@connectiq/types";
import { cacheDel, cacheGet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";

type AuthProfile = {
  userType: PrismaUserType;
  orgId: string | null;
  orgSlug: string | null;
  accountType: PrismaAccountType | null;
  adminStatus: PrismaAdminStatus | null;
  phone: string | null;
};

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function inferAccountType(
  assignments: { role: PrismaUserRole }[],
): PrismaAccountType | null {
  if (assignments.some((item) => item.role === PrismaUserRole.EXPO_ORGANIZER)) {
    return PrismaAccountType.EXPO_ORGANIZER;
  }
  if (assignments.some((item) => item.role === PrismaUserRole.EXHIBITOR)) {
    return PrismaAccountType.EXHIBITOR;
  }
  if (assignments.some((item) => item.role === PrismaUserRole.ORGANIZER)) {
    return PrismaAccountType.CONFERENCE_ORGANIZER;
  }
  return null;
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

async function loadUserAuthProfile(userId: string): Promise<AuthProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      org: {
        select: {
          slug: true,
          accountType: true,
          adminStatus: true,
        },
      },
      roleAssignments: true,
    },
  });

  if (!user) return null;

  const userType = resolveUserType(user.userType, user.roleAssignments);
  const inferredAccountType = inferAccountType(user.roleAssignments);

  return {
    userType,
    orgId: user.orgId,
    orgSlug: user.org?.slug ?? null,
    accountType: user.org?.accountType ?? inferredAccountType,
    adminStatus:
      user.org?.adminStatus ??
      (userType === PrismaUserType.ACCOUNT_ADMIN
        ? PrismaAdminStatus.APPROVED
        : null),
    phone: user.phone,
  };
}

function toLegacyRole(
  userType: PrismaUserType,
  accountType: PrismaAccountType | null,
): AppUserRole {
  if (userType === PrismaUserType.PLATFORM_ADMIN) {
    return PrismaUserRole.PLATFORM_ADMIN as AppUserRole;
  }
  if (userType === PrismaUserType.ACCOUNT_ADMIN) {
    switch (accountType) {
      case PrismaAccountType.EXPO_ORGANIZER:
        return PrismaUserRole.EXPO_ORGANIZER as AppUserRole;
      case PrismaAccountType.EXHIBITOR:
        return PrismaUserRole.EXHIBITOR as AppUserRole;
      default:
        return PrismaUserRole.ORGANIZER as AppUserRole;
    }
  }
  return PrismaUserRole.ORGANIZER as AppUserRole;
}

function toSessionUser(
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
  },
  profile: AuthProfile,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: profile.phone ?? user.phone,
    userType: profile.userType,
    orgId: profile.orgId,
    orgSlug: profile.orgSlug,
    accountType: profile.accountType,
    adminStatus: profile.adminStatus,
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
          include: {
            org: {
              select: {
                slug: true,
                accountType: true,
                adminStatus: true,
              },
            },
            roleAssignments: true,
          },
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
            include: {
              org: {
                select: {
                  slug: true,
                  accountType: true,
                  adminStatus: true,
                },
              },
              roleAssignments: true,
            },
          });
        }

        const profile = await loadUserAuthProfile(user.id);
        if (!profile) return null;

        return toSessionUser(user, profile);
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
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            org: {
              select: {
                slug: true,
                accountType: true,
                adminStatus: true,
              },
            },
            roleAssignments: true,
          },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const profile = await loadUserAuthProfile(user.id);
        if (!profile) return null;

        return toSessionUser(user, profile);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userType = user.userType;
        token.orgId = user.orgId ?? null;
        token.orgSlug = user.orgSlug ?? null;
        token.accountType = user.accountType ?? null;
        token.adminStatus = user.adminStatus ?? null;
        token.phone = user.phone ?? null;
      }

      if (token.sub) {
        const profile = await loadUserAuthProfile(token.sub);
        if (profile) {
          token.userType = profile.userType;
          token.orgId = profile.orgId;
          token.orgSlug = profile.orgSlug;
          token.accountType = profile.accountType;
          token.adminStatus = profile.adminStatus;
          token.phone = profile.phone;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const userType =
          (token.userType as PrismaUserType) ?? PrismaUserType.END_USER;
        const orgId = (token.orgId as string | null) ?? null;
        const accountType = (token.accountType as PrismaAccountType | null) ?? null;

        session.user.id = token.sub ?? "";
        session.user.userType = userType;
        session.user.orgId = orgId;
        session.user.orgSlug = (token.orgSlug as string | null) ?? null;
        session.user.accountType = accountType;
        session.user.adminStatus = (token.adminStatus as string | null) ?? null;
        session.user.phone = (token.phone as string | null) ?? null;

        // 迁移期间：旧组件仍读取 role / entityId / hasPlatformAdmin
        session.user.role = toLegacyRole(userType, accountType);
        session.user.entityId = orgId;
        session.user.hasPlatformAdmin =
          userType === PrismaUserType.PLATFORM_ADMIN;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/** @deprecated 旧角色检查，迁移完成后移除 */
export function hasAnyRole(
  role: AppUserRole,
  allowedRoles: AppUserRole[],
): boolean {
  return allowedRoles.includes(role);
}
