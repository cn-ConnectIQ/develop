import { AccountAdminShell } from "@/components/admin/account-admin-shell";

export default function ExpoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountAdminShell>{children}</AccountAdminShell>;
}
