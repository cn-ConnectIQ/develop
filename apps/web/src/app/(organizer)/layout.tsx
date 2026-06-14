import { UserRole } from "@connectiq/types";
import { AdminLayout } from "@/components/admin/admin-layout";
import { requireLayoutSession } from "@/lib/layout-auth";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireLayoutSession([
    UserRole.ORGANIZER,
  ]);

  return <AdminLayout session={session}>{children}</AdminLayout>;
}
