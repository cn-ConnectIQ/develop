import { redirect } from "next/navigation";

export default async function LegacyBoothLeadsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ boothId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { boothId } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  if (query.grade) qs.set("grade", query.grade);
  if (query.status) qs.set("status", query.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`/exhibitor/booths/${boothId}/leads${suffix}`);
}
