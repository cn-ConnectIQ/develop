import { EventType, prisma } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { StampRallyConfigurator } from "@/components/stamp/StampRallyConfigurator";

export default async function EditStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string; rallyId: string }>;
}) {
  const { eventId, rallyId } = await params;

  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) notFound();

  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
    select: { id: true },
  });
  if (!rally) notFound();

  const event = access.event;

  const isConferenceOrExpo =
    event.type === EventType.CONFERENCE ||
    event.type === EventType.EXPO ||
    event.activityType === "CONFERENCE" ||
    event.activityType === "EXPO";

  if (!isConferenceOrExpo) {
    redirect(`/events/${eventId}`);
  }

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="stampRally"
      title="编辑集章打卡"
      description="配置全场集章打卡路线"
    >
      <StampRallyConfigurator
        eventId={eventId}
        eventName={event.name}
        mode="edit"
        rallyId={rallyId}
      />
    </FeatureFlagGate>
  );
}
