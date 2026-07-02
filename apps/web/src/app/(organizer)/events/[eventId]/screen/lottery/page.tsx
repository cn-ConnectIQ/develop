import { Suspense } from "react";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { LotteryScreenConsole } from "@/components/lottery/LotteryScreenConsole";

export default async function LotteryScreenControlPage({
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

  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-text-muted">加载中…</p>
      }
    >
      <LotteryScreenConsole eventId={eventId} eventName={event.name} />
    </Suspense>
  );
}
