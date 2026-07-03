import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { StampRallyHubClient } from "@/components/stamp-rally/StampRallyHubClient";

export default async function OrganizerStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) notFound();

  const event = access.event;

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="stampRally"
      title="集章打卡"
      description="管理集章路线与实时监控"
    >
      <StampRallyHubClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
