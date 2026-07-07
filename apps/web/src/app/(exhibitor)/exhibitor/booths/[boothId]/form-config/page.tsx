import { notFound } from "next/navigation";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { FormConfigPageClient } from "@/components/exhibitors/FormConfigPageClient";
import { getBoothDashboardData } from "@/lib/dashboard";

export default async function ExhibitorBoothFormConfigPage({
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
        title="采集表单配置"
        description={`${booth.event.name} · ${booth.code}`}
        breadcrumb={["展位设置", "采集表单"]}
      />
      <AdminContent>
        <FormConfigPageClient
          eventId={booth.eventId}
          boothId={boothId}
          lockBoothSelection
        />
      </AdminContent>
    </AdminPage>
  );
}
