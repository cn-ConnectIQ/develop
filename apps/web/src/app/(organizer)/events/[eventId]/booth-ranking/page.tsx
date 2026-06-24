import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { BoothRankingPageClient } from "@/components/expo/BoothRankingPageClient";

export default async function BoothRankingPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) notFound();

  return <BoothRankingPageClient eventId={eventId} />;
}
