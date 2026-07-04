import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireBoothAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { InstantClaimSetupStepper } from "@/components/lottery/InstantClaimSetupStepper";

export default async function BoothInstantClaimNewPage({
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
      title="直接领取"
      description="QUICK-03B · 填表必得单一礼品"
    >
      <InstantClaimSetupStepper
        eventId={eventId}
        boothId={booth.id}
        boothCode={booth.code}
        boothName={booth.name}
        companyName={booth.companyOrg.name}
      />
    </FeatureFlagGate>
  );
}
