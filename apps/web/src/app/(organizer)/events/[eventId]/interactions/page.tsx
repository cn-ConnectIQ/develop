import { InteractionsPageClient } from "@/components/interactions/InteractionsPageClient";

export default async function InteractionsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <InteractionsPageClient eventId={eventId} />;
}
