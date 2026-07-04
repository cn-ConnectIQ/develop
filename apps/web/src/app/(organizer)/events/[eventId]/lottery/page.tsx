import { redirect } from "next/navigation";

export default async function LotteryIndexPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/lottery/big-screen`);
}
