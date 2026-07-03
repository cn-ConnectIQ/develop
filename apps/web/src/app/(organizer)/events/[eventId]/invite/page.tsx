import { Suspense } from "react";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { InviteManagementClient } from "@/components/invites/InviteManagementClient";

export default async function EventInvitePage({
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
      description="发起邀请并为参会者标记身份标签"
    >
      <Suspense>
        <InviteManagementClient eventId={eventId} />
      </Suspense>
    </FeatureFlagGate>
  );
}
