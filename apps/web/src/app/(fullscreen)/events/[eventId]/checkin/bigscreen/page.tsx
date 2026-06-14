import { CheckinBigscreenClient } from "@/components/checkin/CheckinBigscreenClient";

export default async function CheckinBigscreenPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <CheckinBigscreenClient eventId={eventId} />;
}
