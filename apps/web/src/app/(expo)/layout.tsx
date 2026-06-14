import { UserRole } from "@connectiq/types";
import { AdminLayout } from "@/components/admin/admin-layout";
import { requireLayoutSession } from "@/lib/layout-auth";

export default async function ExpoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireLayoutSession([
    UserRole.EXPO_ORGANIZER,
  ]);

  return <AdminLayout session={session}>{children}</AdminLayout>;
}
