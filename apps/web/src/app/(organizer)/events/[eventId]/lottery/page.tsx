import { LotteryPageClient } from "@/components/interactions/LotteryPageClient";

export default async function LotteryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <LotteryPageClient eventId={eventId} />;
}
