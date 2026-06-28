import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { ManageOverviewClient } from "@/components/events/ManageOverviewClient";

export default async function EventManagePage({
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

  return <ManageOverviewClient eventId={event.id} eventName={event.name} />;
}
