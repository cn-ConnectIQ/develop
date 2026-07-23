import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { ProbabilityLotterySetupStepper } from "@/components/lottery/ProbabilityLotterySetupStepper";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function BoothProbabilityLotteryNewPage({
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
        initiator="exhibitor"
        boothId={booth.id}
        boothCode={booth.code}
        boothName={booth.name}
        companyName={booth.companyOrg.name}
      />
    </FeatureFlagGate>
  );
}
