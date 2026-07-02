import { Suspense } from "react";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { LotteryScreenDisplayClient } from "@/components/lottery/LotteryScreenDisplayClient";

export default async function LotteryScreenDisplayPage({
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
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0a0a12] text-white/50">
          加载大屏…
        </div>
      }
    >
      <LotteryScreenDisplayClient eventId={eventId} eventName={event.name} />
    </Suspense>
  );
}
