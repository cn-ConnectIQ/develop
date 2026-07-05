import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { LotteryDashboard } from "@/components/lottery/LotteryDashboard";
import { getLotteryDashboard } from "@/lib/lottery/lottery-dashboard-service";

export default async function OrganizerParticipantLotteryDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string; lotteryId: string }>;
}) {
  const { eventId, lotteryId } = await params;

  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) notFound();

  const lottery = await prisma.lottery.findFirst({
    where: { id: lotteryId, eventId, boothId: null },
    select: { id: true, title: true },
  });
  if (!lottery) notFound();

  const initialData = await getLotteryDashboard(lotteryId);

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="抽奖看板"
      description="主办方参与人抽奖 · 实时数据"
    >
      <LotteryDashboard
        eventId={eventId}
        lotteryId={lotteryId}
        contextLabel="主办方"
        initialData={initialData}
      />
    </FeatureFlagGate>
  );
}
