import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { ScreenPairingsClient } from "@/components/screen/ScreenPairingsClient";

export default async function ScreenPairingsPage({
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
    <ScreenPairingsClient eventId={event.id} eventName={event.name} />
  );
}
