import { Suspense } from "react";
import { InviteCampaignsPageClient } from "./invite-campaigns-client";

export default async function InviteCampaignsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense>
      <InviteCampaignsPageClient eventId={eventId} />
    </Suspense>
  );
}
