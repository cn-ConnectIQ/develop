import { UserRole } from "@connectiq/types";
import { AdminLayout } from "@/components/admin/admin-layout";
import { requireLayoutSession } from "@/lib/layout-auth";

export default async function ExhibitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireLayoutSession([
    UserRole.EXHIBITOR,
  ]);

  return <AdminLayout session={session}>{children}</AdminLayout>;
}
