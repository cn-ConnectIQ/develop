import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { StampRallyConfigurator } from "@/components/stamp/StampRallyConfigurator";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function EditStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string; rallyId: string }>;
}) {
  const { eventId, rallyId } = await params;

  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
    select: { id: true },
  });
  if (!rally) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

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
