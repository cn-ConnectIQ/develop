import { Suspense } from "react";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { CreateCampaignPageClient } from "@/components/invites/CreateCampaignPageClient";

export default async function ParticipantInvitePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="inviteSystem"
      title="发起邀请"
      description="邀请参会者下载 玖莅 进行现场社交"
    >
      <Suspense
        fallback={
          <p className="p-6 text-sm text-muted-foreground">加载邀请配置…</p>
        }
      >
        <CreateCampaignPageClient eventId={eventId} />
      </Suspense>
    </FeatureFlagGate>
  );
}
