import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";

export default function ModerationPage() {
  return (
    <AdminPage>
      <AdminHeader
        title="内容审核"
        description="待审核的用户生成内容与连接附言"
        breadcrumb={["PLATFORM", "内容审核"]}
      />
      <AdminContent>
        <SectionCard
          title="待审核队列"
          description="当前有 3 条待审核内容。完整审核工作流将在后续 Sprint 开放。"
        >
          <p className="text-sm text-text-muted" />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
