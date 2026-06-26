import { AdminLayout } from "@/components/admin/admin-layout";
import { requireAccountAdminLayoutSession } from "@/lib/layout-auth";

export default async function ExpoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAccountAdminLayoutSession();

  return <AdminLayout session={session}>{children}</AdminLayout>;
}
