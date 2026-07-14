import { NotificationWizardClient } from "@/components/notifications/NotificationWizardClient";

export default async function EventNotificationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <NotificationWizardClient eventId={eventId} />;
}
