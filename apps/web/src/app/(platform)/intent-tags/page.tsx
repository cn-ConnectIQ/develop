import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";

export default function IntentTagsPage() {
  return (
    <AdminPage>
      <AdminHeader
        title="意图标签库"
        description="平台级意向标签模板，供各展会活动引用"
        breadcrumb={["PLATFORM", "意图标签库"]}
      />
      <AdminContent>
        <SectionCard
          title="功能开发中"
          description="意图标签库将在后续 Sprint 开放，当前可在各展会的「意向标签」页面管理活动级标签。"
        >
          <p className="text-sm text-text-muted" />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
