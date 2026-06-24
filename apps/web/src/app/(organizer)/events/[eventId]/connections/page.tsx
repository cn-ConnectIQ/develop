import { ConnectionsAnalyticsClient } from "@/components/connections/ConnectionsAnalyticsClient";

export default async function EventConnectionsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <ConnectionsAnalyticsClient eventId={eventId} />;
}
