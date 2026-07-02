import { redirect } from "next/navigation";

export default async function StampMonitorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/stamp-rally#monitor`);
}
