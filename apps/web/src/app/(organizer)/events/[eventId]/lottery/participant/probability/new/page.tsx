import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { ProbabilityLotterySetupStepper } from "@/components/lottery/ProbabilityLotterySetupStepper";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function OrganizerProbabilityLotteryNewPage({
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

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="概率抽奖"
      description="主办方发起 · 行为触发 · 概率引擎"
    >
      <ProbabilityLotterySetupStepper
        eventId={eventId}
        initiator="organizer"
        eventName={event.name}
      />
    </FeatureFlagGate>
  );
}
