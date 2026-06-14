import { Suspense } from "react";
import { ParticipantsPageClient } from "./participants-client";

export default async function EventParticipantsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense>
      <ParticipantsPageClient eventId={eventId} />
    </Suspense>
  );
}
