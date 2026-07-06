import { redirect } from "next/navigation";

/** 已合并至活动工作台 */
export default async function EventManagePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}`);
}
