"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { MeetingAreaManager } from "@/components/meetings/MeetingAreaManager";
import { MeetingConfigPanel } from "@/components/meetings/MeetingConfigPanel";
import type { ApiMeetingArea, ApiMeetingConfig } from "@/lib/meeting-config-service";

async function fetchConfig(eventId: string): Promise<ApiMeetingConfig> {
  const res = await fetch(`/api/events/${eventId}/meeting-config`);
  if (!res.ok) throw new Error("加载配置失败");
  return (await res.json()).data;
}

async function fetchAreas(eventId: string): Promise<ApiMeetingArea[]> {
  const res = await fetch(`/api/events/${eventId}/meeting-areas`);
  if (!res.ok) throw new Error("加载会面区失败");
  return (await res.json()).data.areas;
}

export function MeetingSetupClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const [areas, setAreas] = useState<ApiMeetingArea[]>([]);

  const {
    data: config,
    isLoading: configLoading,
  } = useQuery({
    queryKey: ["meeting-config", eventId],
    queryFn: () => fetchConfig(eventId),
  });

  const {
    data: areasData,
    isLoading: areasLoading,
  } = useQuery({
    queryKey: ["meeting-areas", eventId],
    queryFn: () => fetchAreas(eventId),
  });

  useEffect(() => {
    if (areasData) setAreas(areasData);
  }, [areasData]);

  const refreshConfig = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["meeting-config", eventId] });
  }, [queryClient, eventId]);

  const handleConfigSaved = useCallback(
    (next: ApiMeetingConfig) => {
      queryClient.setQueryData(["meeting-config", eventId], next);
    },
    [queryClient, eventId],
  );

  return (
    <AdminPage>
      <AdminHeader
        title="会面配置"
        description={eventName}
        breadcrumb={["活动", "会面配置"]}
      />
      <AdminContent>
        <MeetingConfigPanel
          eventId={eventId}
          config={config ?? null}
          loading={configLoading}
          onSaved={handleConfigSaved}
        />
        <MeetingAreaManager
          eventId={eventId}
          areas={areas}
          config={config ?? null}
          loading={areasLoading}
          onAreasChange={setAreas}
          onConfigRefresh={refreshConfig}
        />
      </AdminContent>
    </AdminPage>
  );
}
