import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { RedemptionScanPanel } from "@/components/redemption/RedemptionScanPanel";
import { requireRedemptionPageAccess } from "@/lib/lottery/redemption";

/**
 * 兼容旧入口 /verify：与 /redemption 相同，统一走「一码通」核销。
 * 大屏开奖返回的是 UserEventCode，不是 LotteryWinner.verificationCode。
 */
export default async function PrizeVerifyPage({
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
