import { redirect } from "next/navigation";

export default async function BoothRankingPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/exhibitors/booths?sort=popularity`);
}
