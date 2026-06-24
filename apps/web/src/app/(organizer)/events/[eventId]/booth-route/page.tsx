import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { BoothRouteClient } from "@/components/booth-route/BoothRouteClient";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";

export default async function BoothRoutePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true },
  });
  if (!event) notFound();

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="aiBoothRoute"
      title="AI 展位路线"
      description="为参会者生成个性化逛展路线"
    >
      <BoothRouteClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
