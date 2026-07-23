import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { ParticipantLotteryListClient } from "@/components/lottery/ParticipantLotteryListClient";

/**
 * 登录由 middleware 保证；不再用 requireEventAccessCheck + notFound
 *（RSC session 偶发读不到时会被误判成整页 404）。
 */
export default async function ParticipantLotteryListPage({
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
      title="参与人抽奖"
      description="管理展位/现场扫码即抽或即领"
    >
      <ParticipantLotteryListClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
