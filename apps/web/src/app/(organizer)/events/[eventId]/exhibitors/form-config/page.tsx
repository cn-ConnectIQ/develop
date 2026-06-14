import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FormConfigPageClient } from "@/components/exhibitors/FormConfigPageClient";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";

export default async function FormConfigPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, type: true },
  });
  if (!event) notFound();

  const booth = await prisma.booth.findFirst({
    where: { eventId },
    orderBy: { code: "asc" },
    select: { id: true },
  });

  if (!booth) {
    return (
      <AdminPage>
        <AdminHeader
          title="采集表单"
          description={event.name}
          breadcrumb={["活动", "采集表单"]}
        />
        <AdminContent>
        <SectionCard
          title="暂无展位"
          description={
            event.type === "CONFERENCE"
              ? "当前为会议活动，不包含展商展位与线索采集表单。展会类活动可在创建时选择「展览」类型。"
              : "请先创建展位后再配置采集表单。"
          }
        >
          <p className="text-sm text-text-muted" />
        </SectionCard>
        </AdminContent>
      </AdminPage>
    );
  }

  return <FormConfigPageClient eventId={eventId} boothId={booth.id} />;
}
