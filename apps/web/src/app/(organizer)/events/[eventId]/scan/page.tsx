import { ScanPageClient } from "@/components/checkin/ScanPageClient";

export default async function EventScanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <ScanPageClient eventId={eventId} />;
}
