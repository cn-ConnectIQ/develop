import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { AiReferralConfigClient } from "@/components/events/AiReferralConfigClient";

export default async function AiReferralPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="aiReferral"
      title="AI 引荐配置"
      description="间接配对扫描与 Feed 推送"
    >
      <AiReferralConfigClient eventId={eventId} />
    </FeatureFlagGate>
  );
}
