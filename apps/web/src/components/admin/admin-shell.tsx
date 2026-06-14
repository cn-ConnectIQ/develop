"use client";

import type { ReactNode } from "react";
import { AdminSidebar, type AdminUser } from "@/components/admin/admin-sidebar";

type AdminShellProps = {
  user: AdminUser;
  children: ReactNode;
};

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="admin-shell">
      <AdminSidebar user={user} />
      {children}
    </div>
  );
}
