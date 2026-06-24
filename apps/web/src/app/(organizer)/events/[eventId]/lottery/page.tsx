import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { LotteryPageClient } from "@/components/interactions/LotteryPageClient";

export default async function LotteryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="lottery"
      title="现场抽奖"
      description="抽奖活动管理与开奖"
    >
      <LotteryPageClient eventId={eventId} />
    </FeatureFlagGate>
  );
}
