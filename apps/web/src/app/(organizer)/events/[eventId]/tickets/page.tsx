import { redirect } from "next/navigation";

/** @deprecated 票务配置已并入活动设置 Tab */
export default async function EventTicketsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/settings?tab=tickets`);
}
