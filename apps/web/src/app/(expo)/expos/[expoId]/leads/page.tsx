import { AdminContent, AdminHeader, AdminPage, SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import {
  LeadStatusBadge,
  formatDateTime,
} from "@/components/admin/status-badge";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function ExpoLeadsPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;

  const expo = await prisma.event.findUnique({
    where: { id: expoId },
    select: { id: true, name: true },
  });

  if (!expo) notFound();

  const leads = await prisma.lead.findMany({
    where: { booth: { eventId: expoId } },
    include: {
      booth: { select: { code: true, name: true } },
      participant: { select: { name: true, company: true, email: true } },
      intentTags: { include: { intentTag: { select: { label: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminPage>
      <AdminHeader
        title="线索管理"
        description={expo.name}
        breadcrumb={["展会", "线索"]}
      />
      <AdminContent>
        <SectionCard
          id="hosted-buyer"
          title="Hosted Buyer"
          description="高价值买家线索（含 A 级意向标签）"
        >
          <DataTable
            data={leads}
            getRowKey={(row) => row.id}
            columns={[
              {
                key: "participant",
                header: "访客",
                cell: (row) => row.participant.name,
              },
              {
                key: "company",
                header: "公司",
                cell: (row) => row.participant.company ?? "—",
              },
              {
                key: "booth",
                header: "展位",
                cell: (row) => row.booth.code,
              },
              {
                key: "status",
                header: "状态",
                cell: (row) => <LeadStatusBadge status={row.status} />,
              },
              {
                key: "tags",
                header: "意向标签",
                cell: (row) =>
                  row.intentTags.length > 0
                    ? row.intentTags.map((t) => t.intentTag.label).join("、")
                    : "—",
              },
              {
                key: "createdAt",
                header: "创建时间",
                cell: (row) => formatDateTime(row.createdAt),
              },
            ]}
          />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
