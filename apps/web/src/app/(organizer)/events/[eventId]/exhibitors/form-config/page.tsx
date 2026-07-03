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
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ boothId?: string }>;
}) {
  const { eventId } = await params;
  const { boothId: boothIdParam } = await searchParams;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, type: true },
  });
  if (!event) notFound();

  let boothId = boothIdParam?.trim() || null;

  if (boothId) {
    const booth = await prisma.exhibitorBooth.findFirst({
      where: { id: boothId, eventId },
      select: { id: true },
    });
    if (!booth) notFound();
  } else {
    const booth = await prisma.exhibitorBooth.findFirst({
      where: { eventId },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    boothId = booth?.id ?? null;
  }

  if (!boothId) {
    return (
      <AdminPage>
        <AdminHeader
          title="采集表单"
          description={event.name}
          breadcrumb={["展商管理", "采集表单"]}
        />
        <AdminContent>
          <SectionCard
            title="暂无展位"
            description={
              event.type === "CONFERENCE"
                ? "当前为会议活动，不包含展商展位与线索采集表单。展会类活动可在创建时选择「展览」类型。"
                : "请先在展商列表中创建展位，再从列表操作栏进入采集表单配置。"
            }
          >
            <p className="text-sm text-text-muted" />
          </SectionCard>
        </AdminContent>
      </AdminPage>
    );
  }

  return (
    <FormConfigPageClient
      eventId={eventId}
      boothId={boothId}
      lockBoothSelection={Boolean(boothIdParam?.trim())}
    />
  );
}
