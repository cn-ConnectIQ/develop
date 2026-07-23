import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { BigScreenLotteryListClient } from "@/components/lottery/BigScreenLotteryListClient";

/**
 * 大屏抽奖列表。
 * 登录由 middleware 保证；此处不再用 requireEventAccessCheck + notFound
 *（RSC session 偶发读不到时会被误判成整页 404）。
 */
export default async function BigScreenLotteryListPage({
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
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="大屏抽奖"
      description="管理活动收尾仪式、奖池与大屏开奖"
    >
      <BigScreenLotteryListClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
