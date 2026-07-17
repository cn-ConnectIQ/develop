"use client";

import { ExpoOverviewSections } from "@/components/expo/ExpoOverviewSections";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import type { ExpoSettingsPayload } from "@/lib/expo-settings-shared";

export function ExpoSettingsPageClient({
  eventId,
  eventName,
  initialData,
}: {
  eventId: string;
  eventName: string;
  initialData: ExpoSettingsPayload;
}) {
  return (
    <AdminPage>
      <AdminHeader
        title="展会配置"
        description={eventName}
        breadcrumb={["活动", "展会配置"]}
      />
      <AdminContent>
        <ExpoOverviewSections
          expoId={eventId}
          initialData={initialData}
        />
      </AdminContent>
    </AdminPage>
  );
}
