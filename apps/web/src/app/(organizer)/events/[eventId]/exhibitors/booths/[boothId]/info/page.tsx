import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FormConfigPageClient } from "@/components/exhibitors/FormConfigPageClient";
import { AdminHeader, AdminPage } from "@/components/admin/admin-header";

/** 主办代管：展位信息管理（采集表单配置） */
export default async function BoothInfoManagePage({
  params,
}: {
  params: Promise<{ eventId: string; boothId: string }>;
}) {
  const { eventId, boothId } = await params;

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: {
      id: true,
      code: true,
      name: true,
      companyOrg: { select: { name: true } },
      event: { select: { name: true } },
    },
  });
  if (!booth) notFound();

  return (
    <AdminPage>
      <AdminHeader
        title={`信息管理 · ${booth.code}`}
        description={`${booth.event.name} · ${booth.companyOrg.name} · ${booth.name}`}
        breadcrumb={["展商管理", "展商列表", "信息管理"]}
      />
      <FormConfigPageClient
        eventId={eventId}
        boothId={booth.id}
        lockBoothSelection
      />
    </AdminPage>
  );
}
