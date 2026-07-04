import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { ParticipantLotteryListClient } from "@/components/lottery/ParticipantLotteryListClient";

export default async function ParticipantLotteryListPage({
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
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="参与人抽奖"
      description="管理展位/现场扫码即抽或即领"
    >
      <ParticipantLotteryListClient eventId={eventId} />
    </FeatureFlagGate>
  );
}
