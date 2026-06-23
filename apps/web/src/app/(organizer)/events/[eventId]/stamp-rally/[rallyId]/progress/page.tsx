import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { StampRallyProgressClient } from "@/components/stamp-rally/StampRallyProgressClient";

export default async function StampRallyProgressPage({
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
    <StampRallyProgressClient
      eventId={eventId}
      rallyId={rallyId}
      rallyName={rally.name}
    />
  );
}
