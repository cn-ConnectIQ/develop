import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { LotteryDashboard } from "@/components/lottery/LotteryDashboard";
import { getLotteryDashboard } from "@/lib/lottery/lottery-dashboard-service";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function BoothLotteryDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string; boothId: string; lotteryId: string }>;
}) {
  const { eventId, boothId, lotteryId } = await params;

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: { id: true, code: true },
  });
  if (!booth) notFound();

  const lottery = await prisma.lottery.findFirst({
    where: { id: lotteryId, boothId, eventId },
    select: { id: true },
  });
  if (!lottery) notFound();

  const initialData = await getLotteryDashboard(lotteryId);

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="抽奖看板"
      description="实时数据与开奖操作"
    >
      <LotteryDashboard
        eventId={eventId}
        lotteryId={lotteryId}
        contextLabel={booth.code}
        initialData={initialData}
      />
    </FeatureFlagGate>
  );
}
