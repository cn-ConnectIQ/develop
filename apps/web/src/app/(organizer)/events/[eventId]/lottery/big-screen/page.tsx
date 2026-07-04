import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { BigScreenLotteryListClient } from "@/components/lottery/BigScreenLotteryListClient";

export default async function BigScreenLotteryListPage({
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
      title="大屏抽奖"
      description="管理活动收尾仪式、奖池与大屏开奖"
    >
      <BigScreenLotteryListClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
