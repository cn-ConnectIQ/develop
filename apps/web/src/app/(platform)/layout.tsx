import { UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin/admin-layout";
import { authOptions } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-utils";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    !session.user.hasPlatformAdmin
  ) {
    redirect(
      getRoleHomePath(
        session.user.role as UserRole,
        session.user.entityId ?? null,
      ),
    );
  }

  return <AdminLayout session={session}>{children}</AdminLayout>;
}