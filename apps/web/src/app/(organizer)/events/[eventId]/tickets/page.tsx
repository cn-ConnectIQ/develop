import { AdminContent, AdminHeader, AdminPage, SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function EventTicketsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });

  if (!event) notFound();

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId },
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <AdminPage>
      <AdminHeader
        title="票务"
        description={event.name}
        breadcrumb={["活动", "票务"]}
      />
      <AdminContent>
        <SectionCard title="票种列表" description="活动票种与已售数量">
          <DataTable
            data={ticketTypes}
            getRowKey={(row) => row.id}
            columns={[
              { key: "name", header: "票种名称", cell: (row) => row.name },
              {
                key: "price",
                header: "价格",
                cell: (row) => `¥${Number(row.price).toFixed(2)}`,
              },
              {
                key: "quota",
                header: "配额",
                cell: (row) => (row.quota != null ? String(row.quota) : "不限"),
              },
              {
                key: "sold",
                header: "已售",
                cell: (row) => row._count.tickets,
              },
            ]}
          />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
