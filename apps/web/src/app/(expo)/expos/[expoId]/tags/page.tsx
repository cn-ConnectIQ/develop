import { AdminContent, AdminHeader, AdminPage, SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function ExpoTagsPage({
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

  const tags = await prisma.intentTag.findMany({
    where: { eventId: expoId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <AdminPage>
      <AdminHeader
        title="意向标签"
        description={expo.name}
        breadcrumb={["展会", "意向标签"]}
      />
      <AdminContent>
        <SectionCard
          title={`标签列表（${tags.length}）`}
          description="用于标记访客意向的分类标签"
        >
          <DataTable
            data={tags}
            getRowKey={(row) => row.id}
            columns={[
              { key: "label", header: "标签名称", cell: (row) => row.label },
              { key: "slug", header: "标识", cell: (row) => row.slug },
              {
                key: "color",
                header: "颜色",
                cell: (row) =>
                  row.color ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.color}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "sortOrder",
                header: "排序",
                cell: (row) => row.sortOrder,
              },
            ]}
          />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
