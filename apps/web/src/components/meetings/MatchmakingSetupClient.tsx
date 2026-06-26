"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IntentFormBuilder } from "@/components/meetings/IntentFormBuilder";
import { PremeetSettings } from "@/components/meetings/PremeetSettings";
import {
  DEFAULT_INTENT_CONFIG,
  type EventIntentConfig,
} from "@/lib/matchmaking-config";
import type { ApiMatchmakingConfig } from "@/lib/matchmaking-config-service";

type IntentTagRow = {
  id: string;
  label: string;
  pool: string;
};

async function fetchConfig(eventId: string): Promise<ApiMatchmakingConfig> {
  const res = await fetch(`/api/events/${eventId}/matchmaking-config`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

async function fetchTags(eventId: string): Promise<IntentTagRow[]> {
  const res = await fetch(`/api/events/${eventId}/intent-tags`);
  if (!res.ok) throw new Error("加载标签失败");
  return (await res.json()).data.tags;
}

export function MatchmakingSetupClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const [intentConfig, setIntentConfig] = useState<EventIntentConfig>(DEFAULT_INTENT_CONFIG);
  const [premeetEnabled, setPremeetEnabled] = useState(false);
  const [tags, setTags] = useState<IntentTagRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: configMeta, isLoading } = useQuery({
    queryKey: ["matchmaking-config", eventId],
    queryFn: () => fetchConfig(eventId),
  });

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ["event-intent-tags", eventId],
    queryFn: () => fetchTags(eventId),
  });

  useEffect(() => {
    if (configMeta) {
      setIntentConfig(configMeta.intent_config);
      setPremeetEnabled(configMeta.premeet_enabled);
      setDirty(false);
    }
  }, [configMeta]);

  useEffect(() => {
    if (tagsData) setTags(tagsData);
  }, [tagsData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/matchmaking-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent_config: intentConfig,
          premeet_enabled: premeetEnabled,
          premeet_days_before: intentConfig.premeet_days_before,
        }),
      });
      if (!res.ok) {
        toast.error("保存失败");
        return;
      }
      const json = await res.json();
      toast.success("匹配配置已保存");
      setDirty(false);
      queryClient.setQueryData(["matchmaking-config", eventId], json.data);
    } finally {
      setSaving(false);
    }
  }, [eventId, intentConfig, premeetEnabled, queryClient]);

  return (
    <AdminPage>
      <AdminHeader
        title="匹配与意图配置"
        description={eventName}
        breadcrumb={["活动", "匹配预热"]}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/events/${eventId}/matchmaking/responses`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ListChecks className="mr-1 size-4" />
              查看采集结果
            </Link>
            {dirty ? (
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "保存中…" : "保存全部"}
              </Button>
            ) : null}
          </div>
        }
      />
      <AdminContent>
        <PremeetSettings
          config={intentConfig}
          meta={configMeta ?? null}
          premeetEnabled={premeetEnabled}
          onPremeetEnabledChange={(v) => {
            setPremeetEnabled(v);
            setDirty(true);
          }}
          onConfigChange={(c) => {
            setIntentConfig(c);
            setDirty(true);
          }}
        />
        <IntentFormBuilder
          eventId={eventId}
          config={intentConfig}
          tags={tags}
          loading={isLoading || tagsLoading}
          onConfigChange={(c) => {
            setIntentConfig(c);
            setDirty(true);
          }}
          onTagsChange={setTags}
          onSave={handleSave}
          saving={saving}
          dirty={dirty}
        />
      </AdminContent>
    </AdminPage>
  );
}
