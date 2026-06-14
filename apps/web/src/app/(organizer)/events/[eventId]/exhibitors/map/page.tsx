import { BoothMapPageClient } from "@/components/exhibitors/BoothMapPageClient";

export default async function BoothMapPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <BoothMapPageClient eventId={eventId} />;
}
