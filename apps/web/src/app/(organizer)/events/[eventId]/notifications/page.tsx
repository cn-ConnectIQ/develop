import { Suspense } from "react";
import { NotificationManagementClient } from "@/components/notifications/NotificationManagementClient";

export default async function EventNotificationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense>
      <NotificationManagementClient eventId={eventId} />
    </Suspense>
  );
}
