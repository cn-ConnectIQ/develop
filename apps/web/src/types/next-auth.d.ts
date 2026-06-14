import type { UserRole } from "@connectiq/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      entityId: string | null;
      hasPlatformAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    entityId: string | null;
    hasPlatformAdmin: boolean;
  }
}

declare module "next-auth/react" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      entityId: string | null;
      hasPlatformAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    entityId?: string | null;
    hasPlatformAdmin?: boolean;
  }
}
