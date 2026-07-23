import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { OrganizerLotteryConfigurator } from "@/components/lottery/OrganizerLotteryConfigurator";

export default async function BigScreenLotteryEditPage({
  params,
}: {
  params: Promise<{ eventId: string; lotteryId: string }>;
}) {
  const { eventId, lotteryId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  const lottery = await prisma.lottery.findFirst({
    where: { id: lotteryId, eventId },
    select: { id: true },
  });
  if (!lottery) notFound();

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="大屏抽奖配置"
      description="配置参与门槛、大屏开奖仪式与奖品"
    >
      <OrganizerLotteryConfigurator
        eventId={eventId}
        eventName={event.name}
        lotteryId={lotteryId}
        mode="edit"
      />
    </FeatureFlagGate>
  );
}
