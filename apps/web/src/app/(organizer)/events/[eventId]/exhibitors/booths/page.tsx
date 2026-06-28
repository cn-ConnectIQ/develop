import { EventType, prisma } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { ExpoBoothsPageClient } from "@/components/expo/ExpoBoothsPageClient";

export default async function EventExhibitorBoothsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, type: true, activityType: true },
  });

  if (!event) notFound();

  const isExpo =
    event.type === EventType.EXPO || event.activityType === "EXPO";
  if (!isExpo) {
    redirect(`/events/${eventId}`);
  }

  return <ExpoBoothsPageClient eventId={event.id} eventName={event.name} />;
}
