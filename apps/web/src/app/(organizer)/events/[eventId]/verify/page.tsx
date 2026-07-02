import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { PrizeVerifyClient } from "@/components/lottery/PrizeVerifyClient";

export default async function PrizeVerifyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) notFound();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  return <PrizeVerifyClient eventId={eventId} eventName={event.name} />;
}
