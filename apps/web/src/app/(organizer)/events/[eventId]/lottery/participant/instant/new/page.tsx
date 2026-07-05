import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { InstantClaimSetupStepper } from "@/components/lottery/InstantClaimSetupStepper";

export default async function OrganizerInstantClaimNewPage({
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
      title="直接领取"
      description="主办方发起 · QUICK-03B · 填表必得"
    >
      <InstantClaimSetupStepper
        eventId={eventId}
        initiator="organizer"
        eventName={event.name}
      />
    </FeatureFlagGate>
  );
}
