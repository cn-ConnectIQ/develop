import { redirect } from "next/navigation";

/** @deprecated 使用 /events/[eventId]/exhibitors/booths */
export default async function ExpoBoothsPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;
  redirect(`/events/${expoId}/exhibitors/booths`);
}
