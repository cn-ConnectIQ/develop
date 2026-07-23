import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { RedemptionScanPanel } from "@/components/redemption/RedemptionScanPanel";

/**
 * 登录由 middleware 保证；不再用 requireRedemptionPageAccess + notFound
 *（RSC session 偶发读不到时会被误判成整页 404）。
 * 核销 API 仍做权限校验。
 */
export default async function RedemptionPage({
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
    <RedemptionScanPanel eventId={eventId} eventName={event.name} />
  );
}
