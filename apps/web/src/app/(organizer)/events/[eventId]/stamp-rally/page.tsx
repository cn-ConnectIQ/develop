import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { StampRallyPageClient } from "@/components/stamp-rally/StampRallyPageClient";

export default async function OrganizerStampRallyPage({
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
      flag="stampRally"
      title="集章打卡配置"
      description="AI-04 集章打卡路线"
    >
      <StampRallyPageClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
