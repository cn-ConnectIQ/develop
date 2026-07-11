import { EventDashboardClient } from "./event-dashboard-client";
import { loadEventDashboardPayload } from "@/lib/event-dashboard-server";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const initialData = await loadEventDashboardPayload(eventId);

  return (
    <EventDashboardClient eventId={eventId} initialData={initialData ?? undefined} />
  );
}
