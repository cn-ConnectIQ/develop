"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventGeneralSettingsForm } from "@/components/events/EventGeneralSettingsForm";
import {
  EventTicketsPanel,
  type EventTicketTypeRow,
} from "@/components/events/EventTicketsPanel";
import {
  getEventFeatureFlagGroups,
  type EventFeatureFlagKey,
  type EventFeatureFlags,
} from "@/lib/event-feature-flags";

type FeatureFlagsResponse = {
  event_id: string;
  feature_flags: EventFeatureFlags;
};

async function fetchFeatureFlags(eventId: string): Promise<FeatureFlagsResponse> {
  const res = await fetch(`/api/events/${eventId}/feature-flags`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

export function EventSettingsClient({
  eventId,
  eventName,
  ticketTypes,
}: {
  eventId: string;
  eventName: string;
  ticketTypes: EventTicketTypeRow[];
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "tickets" || tabParam === "features" ? tabParam : "general";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (tabParam === "tickets" || tabParam === "features") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["event-feature-flags", eventId],
    queryFn: () => fetchFeatureFlags(eventId),
  });

  const [flags, setFlags] = useState<EventFeatureFlags | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.feature_flags) {
      setFlags(data.feature_flags);
      setDirty(false);
    }
  }, [data]);

  const toggleFlag = useCallback((key: EventFeatureFlagKey, checked: boolean) => {
    setFlags((prev) => (prev ? { ...prev, [key]: checked } : prev));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!flags) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/feature-flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flags),
      });
      if (!res.ok) {
        toast.error("保存失败");
        return;
      }
      toast.success("功能模块设置已保存");
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["event-feature-flags", eventId] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage>
      <AdminHeader
        title="活动设置"
        description={eventName}
        breadcrumb={["活动", "活动设置"]}
        actions={
          dirty ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存更改"}
            </Button>
          ) : null
        }
      />
      <AdminContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-transparent p-0">
            <TabsTrigger
              value="general"
              className="rounded-md border border-transparent px-4 py-2 data-[state=active]:border-border data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              基本信息
            </TabsTrigger>
            <TabsTrigger
              value="tickets"
              className="rounded-md border border-transparent px-4 py-2 data-[state=active]:border-border data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              票务配置
            </TabsTrigger>
            <TabsTrigger
              value="features"
              className="rounded-md border border-transparent px-4 py-2 data-[state=active]:border-border data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              功能模块
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <EventGeneralSettingsForm eventId={eventId} />
          </TabsContent>

          <TabsContent value="tickets">
            <EventTicketsPanel ticketTypes={ticketTypes} />
          </TabsContent>

          <TabsContent value="features">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm text-text-muted">
                按活动开启或关闭非核心功能模块，关闭后移动端与相关管理入口将隐藏对应能力。
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!dirty || saving || isLoading}
              >
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>

            {isLoading || !flags ? (
              <p className="py-12 text-center text-sm text-text-muted">加载中...</p>
            ) : (
              <div className="space-y-6">
                {getEventFeatureFlagGroups().map((group) => (
                  <SectionCard key={group.id} title={group.label}>
                    <div className="divide-y divide-border">
                      {group.items.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text">{item.label}</p>
                            <p className="mt-1 text-sm text-text-muted">{item.description}</p>
                          </div>
                          <Switch
                            checked={flags[item.key]}
                            onCheckedChange={(checked) => toggleFlag(item.key, checked)}
                            aria-label={item.label}
                          />
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </AdminContent>
    </AdminPage>
  );
}
