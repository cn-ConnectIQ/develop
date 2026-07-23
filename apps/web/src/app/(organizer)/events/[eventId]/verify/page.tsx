import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { RedemptionScanPanel } from "@/components/redemption/RedemptionScanPanel";

/**
 * 兼容旧入口 /verify：与 /redemption 相同，统一走「一码通」核销。
 * 登录由 middleware 保证；不再用 access + notFound 假 404。
 * 核销 API 仍做权限校验。
 */
export default async function PrizeVerifyPage({
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
