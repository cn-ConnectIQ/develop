"use client";

import { AdminContent, AdminHeader, AdminPage } from "@/components/admin/admin-header";
import { ExhibitorReviewsPanel } from "@/components/expo/ExhibitorReviewsPanel";

export function ExhibitorReviewsClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  return (
    <AdminPage>
      <AdminHeader
        title="展商列表"
        description={eventName}
        breadcrumb={["展商管理", "展商列表"]}
      />
      <AdminContent>
        <ExhibitorReviewsPanel eventId={eventId} />
      </AdminContent>
    </AdminPage>
  );
}

export type { ExhibitorReviewRow } from "@/components/expo/ExhibitorReviewsPanel";
