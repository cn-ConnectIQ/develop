import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { SpeedNetworkingConfigClient } from "@/components/events/SpeedNetworkingConfigClient";

export default async function SpeedNetworkingPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="speedNetworking"
      title="Speed Networking 配置"
      description="结构化快速配对场次与规则"
    >
      <SpeedNetworkingConfigClient eventId={eventId} />
    </FeatureFlagGate>
  );
}
