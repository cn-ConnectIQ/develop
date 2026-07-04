import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { OrganizerLotteryConfigurator } from "@/components/lottery/OrganizerLotteryConfigurator";

export default async function BigScreenLotteryNewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });

  if (!event) notFound();

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="新建大屏抽奖"
      description="配置参与门槛、大屏开奖仪式与奖品"
    >
      <OrganizerLotteryConfigurator
        eventId={eventId}
        eventName={event.name}
        mode="create"
      />
    </FeatureFlagGate>
  );
}
