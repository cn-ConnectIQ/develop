import { EventDashboardClient } from "./event-dashboard-client";
import { loadEventDashboardPayload } from "@/lib/event-dashboard-server";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  let initialData: Awaited<ReturnType<typeof loadEventDashboardPayload>> | undefined;
  try {
    initialData = (await loadEventDashboardPayload(eventId)) ?? undefined;
  } catch (error) {
    console.error("[event-dashboard] SSR preload failed:", error);
  }

  return (
    <EventDashboardClient eventId={eventId} initialData={initialData} />
  );
}
