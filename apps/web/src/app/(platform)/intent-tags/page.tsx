import { PlatformIntentTagsClient } from "@/components/platform/PlatformIntentTagsClient";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";

export default function IntentTagsPage() {
  return (
    <AdminPage>
      <AdminHeader
        title="意图标签库"
        description="平台级意向标签模板，供各展会活动引用"
        breadcrumb={["PLATFORM", "意图标签库"]}
      />
      <PlatformIntentTagsClient />
    </AdminPage>
  );
}
