import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { EventSettingsClient } from "@/components/events/EventSettingsClient";

export default async function EventSettingsPage({
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

  return <EventSettingsClient eventId={event.id} eventName={event.name} />;
}
