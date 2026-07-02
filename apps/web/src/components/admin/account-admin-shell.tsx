import { AdminLayout } from "@/components/admin/admin-layout";
import { requireAccountAdminLayoutSession } from "@/lib/layout-auth";
import { listAccountAdminEvents } from "@/lib/event-list-service";
import type { EventListResponse } from "@/hooks/useEvents";

/** 账号管理员 layout：服务端一次拉取 session + 活动列表，避免客户端首屏瀑布请求 */
export async function AccountAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAccountAdminLayoutSession();

  let initialEvents: EventListResponse | undefined;
  try {
    initialEvents = await listAccountAdminEvents(session);
  } catch (error) {
    // 不把失败当成「空列表」，否则 EventProvider 会缓存空数据并跳过后续请求
    console.error("[AccountAdminShell] listAccountAdminEvents failed:", error);
    initialEvents = undefined;
  }

  return (
    <AdminLayout session={session} initialEvents={initialEvents}>
      {children}
    </AdminLayout>
  );
}
