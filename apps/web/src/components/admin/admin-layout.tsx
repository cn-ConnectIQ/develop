import type { Session } from "next-auth";
import { AdminLayout as LayoutShell } from "@/components/layout/AdminLayout";
import type { AdminUser } from "@/components/admin/admin-sidebar";
import type { UserRole } from "@connectiq/types";
import type { EventListResponse } from "@/hooks/useEvents";

export function sessionToAdminUser(session: Session): AdminUser {
  return {
    name: session.user.name ?? session.user.email ?? "用户",
    email: session.user.email ?? "",
    role: session.user.role as UserRole,
    entityId: session.user.entityId ?? null,
    hasPlatformAdmin: session.user.hasPlatformAdmin,
  };
}

type AdminLayoutProps = {
  session: Session;
  children: React.ReactNode;
  showHeader?: boolean;
  initialEvents?: EventListResponse;
};

export function AdminLayout({
  session,
  children,
  showHeader = true,
  initialEvents,
}: AdminLayoutProps) {
  return (
    <LayoutShell
      user={sessionToAdminUser(session)}
      showHeader={showHeader}
      initialEvents={initialEvents}
    >
      {children}
    </LayoutShell>
  );
}
