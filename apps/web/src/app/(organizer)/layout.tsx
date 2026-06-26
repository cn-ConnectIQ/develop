import { AccountAdminShell } from "@/components/admin/account-admin-shell";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountAdminShell>{children}</AccountAdminShell>;
}
