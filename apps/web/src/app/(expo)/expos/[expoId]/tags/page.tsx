import { redirect } from "next/navigation";

export default async function ExpoTagsRedirectPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;
  redirect(`/events/${expoId}/intent-tags`);
}
