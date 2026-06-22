import { StampRallyResultsClient } from "@/components/stamp-rally/StampRallyResultsClient";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function StampRallyResultsPage({
  params,
}: {
  params: Promise<{ eventId: string; rallyId: string }>;
}) {
  const { eventId, rallyId } = await params;

  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
    select: { name: true },
  });
  if (!rally) notFound();

  return (
    <StampRallyResultsClient
      eventId={eventId}
      rallyId={rallyId}
      rallyName={rally.name}
    />
  );
}
