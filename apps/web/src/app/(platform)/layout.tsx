import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PlatformAdminLayout } from "@/components/layout/PlatformAdminLayout";
import { sessionToAdminUser } from "@/components/admin/admin-layout";
import { authOptions } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-utils";
import { UserRole } from "@connectiq/types";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isPlatformAdmin =
    session.user.userType === "PLATFORM_ADMIN" ||
    session.user.role === UserRole.PLATFORM_ADMIN ||
    session.user.hasPlatformAdmin;

  if (!isPlatformAdmin) {
    redirect(
      getRoleHomePath(
        session.user.role as UserRole,
        session.user.entityId ?? null,
      ),
    );
  }

  return (
    <PlatformAdminLayout user={sessionToAdminUser(session)}>
      {children}
    </PlatformAdminLayout>
  );
}
