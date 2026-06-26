import { ActivityType, prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { MeetingSetupClient } from "@/components/meetings/MeetingSetupClient";

export default async function MeetingSetupPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, activityType: true },
  });

  if (!event) notFound();

  if (event.activityType === ActivityType.EXHIBITION) {
    notFound();
  }

  return <MeetingSetupClient eventId={eventId} eventName={event.name} />;
}
