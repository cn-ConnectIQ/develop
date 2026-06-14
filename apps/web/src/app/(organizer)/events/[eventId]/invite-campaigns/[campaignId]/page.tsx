import { Suspense } from "react";
import { CampaignDetailClient } from "./campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; campaignId: string }>;
}) {
  const { eventId, campaignId } = await params;
  return (
    <Suspense>
      <CampaignDetailClient eventId={eventId} campaignId={campaignId} />
    </Suspense>
  );
}
