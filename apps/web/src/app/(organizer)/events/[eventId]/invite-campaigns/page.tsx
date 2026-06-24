import { Suspense } from "react";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { InviteCampaignsPageClient } from "./invite-campaigns-client";

export default async function InviteCampaignsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="inviteSystem"
      title="邀请管理"
      description="邀请活动与发送记录"
    >
      <Suspense>
        <InviteCampaignsPageClient eventId={eventId} />
      </Suspense>
    </FeatureFlagGate>
  );
}
