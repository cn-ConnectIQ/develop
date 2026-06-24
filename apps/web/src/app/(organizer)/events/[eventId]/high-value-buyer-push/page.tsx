import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { HighValueBuyerPushConfigClient } from "@/components/events/HighValueBuyerPushConfigClient";

export default async function HighValueBuyerPushPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="highValueBuyerPush"
      title="高价值买家推送"
      description="向展商推送 A/B 级意向买家提醒"
    >
      <HighValueBuyerPushConfigClient eventId={eventId} />
    </FeatureFlagGate>
  );
}
