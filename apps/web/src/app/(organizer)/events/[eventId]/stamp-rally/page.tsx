import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { StampRallyHubClient } from "@/components/stamp-rally/StampRallyHubClient";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
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
      title="集章打卡"
      description="管理集章路线与实时监控"
    >
      <StampRallyHubClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
