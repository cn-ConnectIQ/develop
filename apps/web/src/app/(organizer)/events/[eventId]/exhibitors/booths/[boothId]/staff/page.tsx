import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { BoothStaffPageClient } from "@/components/exhibitors/BoothStaffPageClient";

/** 主办代管：展位工作人员 */
export default async function HostBoothStaffPage({
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
      event: { select: { name: true } },
    },
  });
  if (!booth) notFound();

  return (
    <BoothStaffPageClient
      boothId={booth.id}
      boothCode={booth.code}
      eventName={booth.event.name}
      breadcrumb={["展商管理", "展商列表", "工作人员"]}
      titlePrefix="工作人员"
    />
  );
}
