import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventSettingsClient } from "@/components/events/EventSettingsClient";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const [event, ticketTypes] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    }),
    prisma.ticketType.findMany({
      where: { eventId },
      include: { _count: { select: { tickets: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!event) notFound();

  const ticketRows = ticketTypes.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    quota: row.quota,
    soldCount: row._count.tickets,
  }));

  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">加载活动设置…</p>}>
      <EventSettingsClient
        eventId={event.id}
        eventName={event.name}
        ticketTypes={ticketRows}
      />
    </Suspense>
  );
}
