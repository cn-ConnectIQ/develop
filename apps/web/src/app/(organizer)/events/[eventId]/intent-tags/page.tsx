import { redirect } from "next/navigation";

/** 活动级意向标签已合并至「匹配预热」 */
export default async function EventIntentTagsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/matchmaking`);
}
