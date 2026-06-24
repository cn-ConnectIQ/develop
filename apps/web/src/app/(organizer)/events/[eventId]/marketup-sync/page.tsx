import { EventMarketupSyncClient } from "@/components/integrations/EventMarketupSyncClient";

export default async function EventMarketupSyncPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventMarketupSyncClient eventId={eventId} />;
}
