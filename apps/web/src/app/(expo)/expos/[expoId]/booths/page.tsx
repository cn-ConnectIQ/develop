import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { ExpoBoothsPageClient } from "@/components/expo/ExpoBoothsPageClient";

export default async function ExpoBoothsPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;

  const expo = await prisma.event.findUnique({
    where: { id: expoId },
    select: { id: true, name: true },
  });

  if (!expo) notFound();

  return <ExpoBoothsPageClient eventId={expoId} eventName={expo.name} />;
}
