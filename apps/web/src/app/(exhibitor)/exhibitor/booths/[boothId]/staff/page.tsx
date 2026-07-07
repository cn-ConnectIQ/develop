import { notFound } from "next/navigation";
import { BoothStaffPageClient } from "@/components/exhibitors/BoothStaffPageClient";
import { getBoothDashboardData } from "@/lib/dashboard";

export default async function ExhibitorBoothStaffPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const { boothId } = await params;
  const booth = await getBoothDashboardData(boothId);

  if (!booth) notFound();

  return (
    <BoothStaffPageClient
      boothId={boothId}
      boothCode={booth.code}
      eventName={booth.event.name}
    />
  );
}
