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

      // 多组织支持（原来 orgId 改为 activeOrgId）
      activeOrgId?: string | null;
      activeOrgSlug?: string | null;
      activeOrgType?: string | null;
      activeAdminStatus?: string | null;

      /** 参展商当前展位 ID（导航用） */
      boothId?: string | null;
      boothEventName?: string | null;

      // 用户拥有的所有组织（供切换器使用，轻量摘要）
      ownedOrgs?: Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        account_type: string;
        admin_status: string;
      }>;

      /** @deprecated 由 userType + activeOrgType 推导，供旧组件使用 */
      role: UserRole;
      /** @deprecated 映射 activeOrgId */
      entityId?: string | null;
      /** @deprecated 映射 userType === PLATFORM_ADMIN */
      hasPlatformAdmin?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    userType: string;
    phone?: string | null;
    activeOrgId?: string | null;
    activeOrgSlug?: string | null;
    activeOrgType?: string | null;
    activeAdminStatus?: string | null;
    boothId?: string | null;
    boothEventName?: string | null;
    ownedOrgs?: Array<{
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      account_type: string;
      admin_status: string;
    }>;
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
      activeOrgId?: string | null;
      activeOrgSlug?: string | null;
      activeOrgType?: string | null;
      activeAdminStatus?: string | null;
      boothId?: string | null;
      boothEventName?: string | null;
      ownedOrgs?: Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        account_type: string;
        admin_status: string;
      }>;
      role: UserRole;
      entityId?: string | null;
      hasPlatformAdmin?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    userType?: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
    activeOrgId?: string | null;
    activeOrgSlug?: string | null;
    activeOrgType?: string | null;
    activeAdminStatus?: string | null;
    boothId?: string | null;
    boothEventName?: string | null;
    ownedOrgs?: Array<{
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      account_type: string;
      admin_status: string;
    }>;
    phone?: string | null;
    /** @deprecated 由 userType + activeOrgType 推导 */
    role?: UserRole;
    /** @deprecated 映射 activeOrgId */
    entityId?: string | null;
  }
}
