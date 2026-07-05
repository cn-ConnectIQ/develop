import { EventType, prisma } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { ExpoSettingsPageClient } from "@/components/expo/ExpoSettingsPageClient";
import { loadExpoSettingsPayload } from "@/lib/expo-settings-service";

export default async function ExpoSettingsPage({
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

  const initialData = await loadExpoSettingsPayload(eventId);

  return (
    <ExpoSettingsPageClient
      eventId={eventId}
      eventName={event.name}
      initialData={initialData}
    />
  );
}
