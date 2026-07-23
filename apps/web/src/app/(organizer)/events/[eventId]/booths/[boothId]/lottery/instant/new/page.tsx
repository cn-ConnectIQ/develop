import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { InstantClaimSetupStepper } from "@/components/lottery/InstantClaimSetupStepper";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function BoothInstantClaimNewPage({
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
      title="直接领取"
      description="QUICK-03B · 填表必得单一礼品"
    >
      <InstantClaimSetupStepper
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
