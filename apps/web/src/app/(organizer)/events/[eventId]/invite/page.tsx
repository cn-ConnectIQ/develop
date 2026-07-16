import { redirect } from "next/navigation";

/** 邀请能力已归并至「参与人员管理」 */
export default async function EventInvitePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/participants?tab=invite`);
}
