import type { UserRole } from "@connectiq/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      // 三层角色
      userType: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
      // 账号管理员专属
      orgId?: string | null;
      orgSlug?: string | null;
      accountType?: string | null;
      adminStatus?: string | null;
      /** @deprecated 迁移期间由 userType 推导，供旧组件使用 */
      role: UserRole;
      /** @deprecated 迁移期间映射 orgId */
      entityId?: string | null;
      /** @deprecated 迁移期间映射 userType === PLATFORM_ADMIN */
      hasPlatformAdmin?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    userType: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
    orgId?: string | null;
    orgSlug?: string | null;
    accountType?: string | null;
    adminStatus?: string | null;
    phone?: string | null;
  }
}

declare module "next-auth/react" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      userType: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
      orgId?: string | null;
      orgSlug?: string | null;
      accountType?: string | null;
      adminStatus?: string | null;
      role: UserRole;
      entityId?: string | null;
      hasPlatformAdmin?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userType?: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
    orgId?: string | null;
    orgSlug?: string | null;
    accountType?: string | null;
    adminStatus?: string | null;
    phone?: string | null;
  }
}
