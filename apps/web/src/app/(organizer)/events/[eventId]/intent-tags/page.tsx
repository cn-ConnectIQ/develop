import { Suspense } from "react";
import { IntentTagsManagementClient } from "@/components/intent-tags/IntentTagsManagementClient";

export default async function EventIntentTagsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <Suspense>
      <IntentTagsManagementClient eventId={eventId} />
    </Suspense>
  );
}
