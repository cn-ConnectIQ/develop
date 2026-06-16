import { AdminContent, AdminHeader, AdminPage, SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { BoothStatusBadge } from "@/components/admin/status-badge";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function ExpoBoothsPage({
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

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: expoId },
    include: {
      companyOrg: { select: { name: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { code: "asc" },
  });

  return (
    <AdminPage>
      <AdminHeader
        title="展位管理"
        description={expo.name}
        breadcrumb={["展会", "展位"]}
      />
      <AdminContent>
        <SectionCard
          title={`全部展位（${booths.length}）`}
          description="展会展位与展商分配"
        >
          <DataTable
            data={booths}
            getRowKey={(row) => row.id}
            columns={[
              { key: "code", header: "展位号", cell: (row) => row.code },
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
              {
                key: "leads",
                header: "线索数",
                cell: (row) => row._count.leads,
              },
            ]}
          />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
