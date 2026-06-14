import { ReportsPageClient } from "@/components/reports/ReportsPageClient";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <ReportsPageClient eventId={eventId} />;
}
