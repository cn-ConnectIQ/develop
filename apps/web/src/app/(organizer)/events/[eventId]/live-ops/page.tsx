import { LiveOpsPageClient } from "@/components/liveops/LiveOpsPageClient";

export default async function LiveOpsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <LiveOpsPageClient eventId={eventId} />;
}
