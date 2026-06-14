import { CheckinPageClient } from "@/components/checkin/CheckinPageClient";

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <CheckinPageClient eventId={eventId} />;
}
