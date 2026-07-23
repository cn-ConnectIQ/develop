import { Suspense } from "react";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { LotteryScreenConsole } from "@/components/lottery/LotteryScreenConsole";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function LotteryScreenControlPage({
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
        <p className="py-16 text-center text-sm text-text-muted">加载中…</p>
      }
    >
      <LotteryScreenConsole eventId={eventId} eventName={event.name} />
    </Suspense>
  );
}
