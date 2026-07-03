import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { RedemptionScanPanel } from "@/components/redemption/RedemptionScanPanel";
import { requireRedemptionPageAccess } from "@/lib/lottery/redemption";

export default async function RedemptionPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const allowed = await requireRedemptionPageAccess(eventId);
  if (!allowed) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  return (
    <RedemptionScanPanel eventId={eventId} eventName={event.name} />
  );
}
