import { redirect } from "next/navigation";

export default async function ExhibitorReviewsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/exhibitors/booths#reviews`);
}
