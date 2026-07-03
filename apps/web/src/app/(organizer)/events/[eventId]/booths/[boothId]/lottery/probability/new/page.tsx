import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireBoothAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { ProbabilityLotterySetupStepper } from "@/components/lottery/ProbabilityLotterySetupStepper";

export default async function BoothProbabilityLotteryNewPage({
  params,
}: {
  params: Promise<{ eventId: string; boothId: string }>;
}) {
  const { eventId, boothId } = await params;

  const access = await requireBoothAccessCheck(boothId);
  if ("error" in access) notFound();

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: {
      id: true,
      code: true,
      name: true,
      companyOrg: { select: { name: true } },
    },
  });

  if (!booth) notFound();

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="概率抽奖"
      description="行为触发 · 概率引擎 · 动效选择"
    >
      <ProbabilityLotterySetupStepper
        eventId={eventId}
        boothId={booth.id}
        boothCode={booth.code}
        boothName={booth.name}
        companyName={booth.companyOrg.name}
      />
    </FeatureFlagGate>
  );
}
