import { Suspense } from "react";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { CampaignDetailClient } from "./campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; campaignId: string }>;
}) {
  const { eventId, campaignId } = await params;
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="inviteSystem"
      title="邀请活动详情"
    >
      <Suspense>
        <CampaignDetailClient eventId={eventId} campaignId={campaignId} />
      </Suspense>
    </FeatureFlagGate>
  );
}
