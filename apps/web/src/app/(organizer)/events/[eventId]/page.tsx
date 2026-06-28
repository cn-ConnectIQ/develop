import { EventDashboardClient } from "./event-dashboard-client";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventDashboardClient eventId={eventId} />;
}
