import { authOptions, hasAnyRole } from "@/lib/auth";
import type { UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

const PLATFORM_ADMIN = "PLATFORM_ADMIN" as UserRole;

export async function requireLayoutSession(
  allowedRoles: UserRole[],
): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const rolesWithAdmin = [...allowedRoles, PLATFORM_ADMIN];
  if (!hasAnyRole(session.user.role, rolesWithAdmin)) {
    redirect("/403");
  }

  return session;
}
