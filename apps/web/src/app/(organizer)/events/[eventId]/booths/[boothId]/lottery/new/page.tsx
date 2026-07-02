import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireBoothAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { LotterySetupStepper } from "@/components/lottery/LotterySetupStepper";

export default async function BoothLotteryNewPage({
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
      event: { select: { id: true, name: true } },
    },
  });

  if (!booth) notFound();

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="展位抽奖"
      description="配置奖品、留资规则与互动码"
    >
      <LotterySetupStepper
        eventId={eventId}
        boothId={booth.id}
        boothCode={booth.code}
        boothName={booth.name}
        companyName={booth.companyOrg.name}
      />
    </FeatureFlagGate>
  );
}
