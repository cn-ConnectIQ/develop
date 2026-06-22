import { AdminHeader, AdminPage } from "@/components/admin/admin-header";
import { BoothDashboardClient } from "@/components/exhibitors/BoothDashboardClient";
import { getBoothDashboardData } from "@/lib/dashboard";
import { notFound } from "next/navigation";

export default async function BoothDashboardPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const { boothId } = await params;
  const booth = await getBoothDashboardData(boothId);

  if (!booth) notFound();

  return (
    <AdminPage>
      <AdminHeader
        title={`展位 ${booth.code}`}
        description={booth.event.name}
        breadcrumb={["展位概况", "实时看板"]}
      />
      <BoothDashboardClient boothId={boothId} />
    </AdminPage>
  );
}
