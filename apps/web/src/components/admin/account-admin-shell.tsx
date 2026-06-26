import { AdminLayout } from "@/components/admin/admin-layout";
import { requireAccountAdminLayoutSession } from "@/lib/layout-auth";
import { listAccountAdminEvents } from "@/lib/event-list-service";
import type { EventListResponse } from "@/hooks/useEvents";

const EMPTY_EVENTS: EventListResponse = {
  events: [],
  stats: { live: 0, today: 0, upcoming: 0, draft: 0, ended: 0 },
};

/** 账号管理员 layout：服务端一次拉取 session + 活动列表，避免客户端首屏瀑布请求 */
export async function AccountAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAccountAdminLayoutSession();

  let initialEvents = EMPTY_EVENTS;
  try {
    initialEvents = await listAccountAdminEvents(session);
  } catch (error) {
    console.error("[AccountAdminShell] listAccountAdminEvents failed:", error);
  }

  return (
    <AdminLayout session={session} initialEvents={initialEvents}>
      {children}
    </AdminLayout>
  );
}
