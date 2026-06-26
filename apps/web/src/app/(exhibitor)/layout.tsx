import { AccountAdminShell } from "@/components/admin/account-admin-shell";

export default function ExhibitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountAdminShell>{children}</AccountAdminShell>;
}
