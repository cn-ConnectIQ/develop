import { Suspense } from "react";
import { EventDataImportClient } from "@/components/events/EventDataImportClient";

export default async function EventDataImportPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense>
      <EventDataImportClient eventId={eventId} />
    </Suspense>
  );
}
