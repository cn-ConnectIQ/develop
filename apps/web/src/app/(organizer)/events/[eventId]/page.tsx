import { EventDashboardClient } from "./event-dashboard-client";
import { loadEventDashboardPayload } from "@/lib/event-dashboard-server";
import type { EventDashboardPayload } from "@/lib/event-dashboard-types";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  let initialData: EventDashboardPayload | undefined;
  try {
    initialData = (await loadEventDashboardPayload(eventId)) ?? undefined;
  } catch (error) {
    console.error("[event-dashboard] SSR preload failed:", error);
  }

  return (
    <EventDashboardClient eventId={eventId} initialData={initialData} />
  );
}
