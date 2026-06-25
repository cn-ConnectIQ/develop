import { BoothInteractionsPageClient } from "@/components/exhibitor/BoothInteractionsPageClient";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function ExhibitorBoothInteractionsPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const { boothId } = await params;

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      code: true,
      event: { select: { name: true } },
    },
  });

  if (!booth) notFound();

  return (
    <BoothInteractionsPageClient
      boothId={booth.id}
      boothCode={booth.code}
      eventName={booth.event.name}
    />
  );
}
