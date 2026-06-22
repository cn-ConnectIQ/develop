import { BoothRouteClient } from "@/components/booth-route/BoothRouteClient";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

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

  return <BoothRouteClient eventId={eventId} eventName={event.name} />;
}
