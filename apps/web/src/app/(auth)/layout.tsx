import { authOptions } from "@/lib/auth";
import { getAdminHomePath } from "@/lib/role-utils";
import { UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const userType = session?.user?.userType;
  if (
    session?.user?.role &&
    (userType === "PLATFORM_ADMIN" || userType === "ACCOUNT_ADMIN")
  ) {
    redirect(
      getAdminHomePath(
        session.user.role as UserRole,
        session.user.entityId ?? null,
        session.user.hasPlatformAdmin,
      ),
    );
  }

  return <>{children}</>;
}
