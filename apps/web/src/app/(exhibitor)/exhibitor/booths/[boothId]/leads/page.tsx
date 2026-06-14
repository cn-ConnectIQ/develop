import { AdminContent, AdminHeader, AdminPage, SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import {
  LeadStatusBadge,
  formatDateTime,
} from "@/components/admin/status-badge";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function ExhibitorBoothLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boothId: string }>;
  searchParams: Promise<{ grade?: string; status?: string }>;
}) {
  const { boothId } = await params;
  const { grade, status } = await searchParams;

  const booth = await prisma.booth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      code: true,
      event: { select: { name: true, id: true } },
    },
  });

  if (!booth) notFound();

  const leads = await prisma.lead.findMany({
    where: {
      boothId,
      ...(status === "followup"
        ? { status: { in: ["NEW", "CONTACTED"] } }
        : {}),
      ...(grade === "A"
        ? {
            intentTags: {
              some: {
                intentTag: {
                  OR: [
                    { label: { contains: "采购" } },
                    { label: { contains: "投资" } },
                  ],
                },
              },
            },
          }
        : {}),
    },
    include: {
      participant: {
        select: { name: true, company: true, email: true, phone: true },
      },
      intentTags: { include: { intentTag: { select: { label: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const title =
    grade === "A"
      ? "A 级线索"
      : status === "followup"
        ? "待跟进"
        : "来访客户列表";

  return (
    <AdminPage>
      <AdminHeader
        title={title}
        description={`展位 ${booth.code} · ${booth.event.name}`}
        breadcrumb={["线索管理", title]}
      />
      <AdminContent>
        <SectionCard
          title={`${title}（${leads.length}）`}
          description="本展位收集的访客线索"
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
                key: "email",
                header: "邮箱",
                cell: (row) => row.participant.email ?? "—",
              },
              {
                key: "phone",
                header: "手机",
                cell: (row) => row.participant.phone ?? "—",
              },
              {
                key: "status",
                header: "状态",
                cell: (row) => <LeadStatusBadge status={row.status} />,
              },
              {
                key: "tags",
                header: "意向等级",
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
