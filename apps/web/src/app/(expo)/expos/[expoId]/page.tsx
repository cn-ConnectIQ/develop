import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminContent, AdminHeader, AdminPage, AiInsight, SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { QuickTile, QuickTileGrid } from "@/components/admin/quick-tile";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import {
  BoothStatusBadge,
  EventStatusBadge,
  formatDate,
} from "@/components/admin/status-badge";
import { getExpoDashboardData } from "@/lib/dashboard";
import { Store, Tag, Users } from "lucide-react";
import { ExpoOverviewSections } from "@/components/expo/ExpoOverviewSections";
import Link from "next/link";

export default async function ExpoPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;
  const session = await getServerSession(authOptions);

  // 统一组织账号管理员走 /events/ 工作台，避免误入 legacy /expos/ 路由
  if (
    session?.user.userType === "ACCOUNT_ADMIN" ||
    session?.user.userType === "PLATFORM_ADMIN"
  ) {
    redirect(`/events/${expoId}`);
  }

  const expo = await getExpoDashboardData(expoId);

  if (!expo) notFound();

  return (
    <AdminPage>
      <AdminHeader
        title={expo.name}
        description={expo.location ?? "展会管理"}
        breadcrumb={["展会", "概览"]}
      />
      <AdminContent>
        <StatGrid columns={3}>
          <StatCard label="展位" value={expo._count.booths} accent="blue" />
          <StatCard
            label="参会者"
            value={expo._count.participants}
            accent="green"
          />
          <StatCard
            label="意向标签"
            value={expo._count.intentTags}
            accent="purple"
          />
        </StatGrid>

        <div className="flex flex-wrap items-center gap-3 text-[13px] text-text-muted">
          <span>状态：<EventStatusBadge status={expo.status} /></span>
          <span>开始：{formatDate(expo.startDate)}</span>
        </div>

        <AiInsight title="展会运营建议">
          当前展会共有 {expo._count.booths} 个展位与 {expo._count.intentTags}{" "}
          个意向标签。建议展商及时跟进展位线索，并根据意向标签分类进行精准营销。
        </AiInsight>

        <SectionCard title="快捷操作">
          <QuickTileGrid>
            <QuickTile
              title="展位管理"
              description={`${expo._count.booths} 个展位`}
              href={`/expos/${expoId}/booths`}
              icon={Store}
            />
            <QuickTile
              title="线索管理"
              description="查看全部展位线索"
              href={`/expos/${expoId}/leads`}
              icon={Users}
            />
            <QuickTile
              title="意向标签"
              description={`${expo._count.intentTags} 个标签`}
              href={`/expos/${expoId}/tags`}
              icon={Tag}
            />
          </QuickTileGrid>
        </SectionCard>

        <SectionCard title="展位一览">
          <DataTable
            data={expo.booths}
            getRowKey={(row) => row.id}
            dense
            columns={[
              {
                key: "code",
                header: "展位号",
                cell: (row) => (
                  <Link
                    href={`/exhibitor/booths/${row.id}`}
                    className="font-medium text-brand-blue hover:underline"
                  >
                    {row.code}
                  </Link>
                ),
              },
              { key: "name", header: "名称", cell: (row) => row.name },
              {
                key: "exhibitor",
                header: "展商",
                cell: (row) => row.companyOrg.name,
              },
              {
                key: "status",
                header: "状态",
                cell: (row) => <BoothStatusBadge status={row.status} />,
              },
            ]}
          />
        </SectionCard>

        <ExpoOverviewSections expoId={expoId} />
      </AdminContent>
    </AdminPage>
  );
}
