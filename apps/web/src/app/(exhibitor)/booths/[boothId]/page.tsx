import { redirect } from "next/navigation";

export default async function LegacyBoothRedirect({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const { boothId } = await params;
  redirect(`/exhibitor/booths/${boothId}`);
}
