import { PlatformModerationClient } from "@/components/platform/PlatformModerationClient";
import {
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";

export default function ModerationPage() {
  return (
    <AdminPage>
      <AdminHeader
        title="内容审核"
        description="待审核的用户生成内容与连接附言"
        breadcrumb={["PLATFORM", "内容审核"]}
      />
      <PlatformModerationClient />
    </AdminPage>
  );
}
