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
      activeOrgId?: string | null; // 当前激活的组织 ID
      activeOrgSlug?: string | null; // 当前激活组织的 slug
      activeOrgType?: string | null; // 当前激活组织的 account_type
      activeAdminStatus?: string | null; // 当前激活组织的 admin_status

      // 用户拥有的所有组织（供切换器使用，轻量摘要）
      ownedOrgs?: Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        account_type: string;
        admin_status: string;
      }>;
    };
  }

  interface User {
    id: string;
    userType: string;
    activeOrgId?: string | null;
    activeOrgSlug?: string | null;
    activeOrgType?: string | null;
    activeAdminStatus?: string | null;
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
      ownedOrgs?: Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        account_type: string;
        admin_status: string;
      }>;
    };
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
    ownedOrgs?: Array<{
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      account_type: string;
      admin_status: string;
    }>;
    phone?: string | null;
  }
}
