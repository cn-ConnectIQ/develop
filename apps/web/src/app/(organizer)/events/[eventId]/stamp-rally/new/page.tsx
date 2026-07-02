import { EventType, prisma } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { StampRallyConfigurator } from "@/components/stamp/StampRallyConfigurator";

export default async function NewStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, type: true, activityType: true },
  });

  if (!event) notFound();

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
      title="新建集章打卡"
      description="配置全场集章打卡路线"
    >
      <StampRallyConfigurator
        eventId={eventId}
        eventName={event.name}
        mode="create"
      />
    </FeatureFlagGate>
  );
}
