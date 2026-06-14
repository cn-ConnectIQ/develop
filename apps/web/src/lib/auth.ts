import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, PrismaUserRole } from "@connectiq/database";
import type { UserRole as AppUserRole } from "@connectiq/types";
import { cacheDel, cacheGet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";

const ROLE_PRIORITY: AppUserRole[] = [
  PrismaUserRole.PLATFORM_ADMIN,
  PrismaUserRole.ORGANIZER,
  PrismaUserRole.EXPO_ORGANIZER,
  PrismaUserRole.EXHIBITOR,
];

export function hasAnyRole(role: AppUserRole, allowedRoles: AppUserRole[]): boolean {
  return allowedRoles.includes(role);
}

function pickPrimaryAssignment(
  assignments: { role: PrismaUserRole; entityId: string | null }[],
) {
  for (const role of ROLE_PRIORITY) {
    const match = assignments.find((item) => item.role === role);
    if (match) return match;
  }
  return assignments[0];
}

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
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
              roleAssignments: {
                create: { role: PrismaUserRole.ORGANIZER },
              },
            },
            include: { roleAssignments: true },
          });
        }

        if (user.roleAssignments.length === 0) return null;

        const assignment = pickPrimaryAssignment(user.roleAssignments);
        if (!assignment) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: assignment.role,
          entityId: assignment.entityId,
          hasPlatformAdmin: user.roleAssignments.some(
            (item) => item.role === PrismaUserRole.PLATFORM_ADMIN,
          ),
        };
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
          include: { roleAssignments: true },
        });

        if (!user || user.roleAssignments.length === 0) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const assignment = pickPrimaryAssignment(user.roleAssignments);
        if (!assignment) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: assignment.role,
          entityId: assignment.entityId,
          hasPlatformAdmin: user.roleAssignments.some(
            (item) => item.role === PrismaUserRole.PLATFORM_ADMIN,
          ),
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.entityId = user.entityId ?? null;
        token.hasPlatformAdmin = user.hasPlatformAdmin;
      }
      if (trigger === "update" && session) {
        const update = session as {
          role?: AppUserRole;
          entityId?: string | null;
        };
        if (update.role) token.role = update.role;
        if (update.entityId !== undefined) token.entityId = update.entityId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as AppUserRole;
        session.user.entityId = (token.entityId as string | null) ?? null;
        session.user.hasPlatformAdmin =
          token.hasPlatformAdmin ??
          token.role === PrismaUserRole.PLATFORM_ADMIN;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
