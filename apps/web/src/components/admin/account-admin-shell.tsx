import { AdminLayout } from "@/components/admin/admin-layout";
import { requireAccountAdminLayoutSession } from "@/lib/layout-auth";
import { listAccountAdminEvents } from "@/lib/event-list-service";

/** 账号管理员 layout：服务端一次拉取 session + 活动列表，避免客户端首屏瀑布请求 */
export async function AccountAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAccountAdminLayoutSession();
  const initialEvents = await listAccountAdminEvents(session);

  return (
    <AdminLayout session={session} initialEvents={initialEvents}>
      {children}
    </AdminLayout>
  );
}
