import { redirect } from "next/navigation";

/** @deprecated 使用 /events/[eventId]/admin-leads */
export default async function ExpoLeadsPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;
  redirect(`/events/${expoId}/admin-leads`);
}
