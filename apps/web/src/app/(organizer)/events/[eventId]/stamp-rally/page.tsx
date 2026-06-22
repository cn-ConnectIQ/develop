import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { StampRallyPageClient } from "@/components/stamp-rally/StampRallyPageClient";

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
    <StampRallyPageClient eventId={eventId} eventName={event.name} />
  );
}
