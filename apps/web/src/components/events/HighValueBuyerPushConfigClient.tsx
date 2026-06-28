"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { HighValueBuyerPushConfig } from "@/lib/high-value-buyer-push-config";

async function fetchConfig(eventId: string): Promise<HighValueBuyerPushConfig> {
  const res = await fetch(`/api/events/${eventId}/high-value-buyer-push`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.config as HighValueBuyerPushConfig;
}

export function HighValueBuyerPushConfigClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["high-value-buyer-push", eventId],
    queryFn: () => fetchConfig(eventId),
  });

  const [config, setConfig] = useState<HighValueBuyerPushConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setConfig(data);
      setDirty(false);
    }
  }, [data]);

  const update = <K extends keyof HighValueBuyerPushConfig>(
    key: K,
    value: HighValueBuyerPushConfig[K],
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/high-value-buyer-push`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        toast.error("保存失败");
        return;
      }
      toast.success("推送规则已保存");
      setDirty(false);
      void queryClient.invalidateQueries({
        queryKey: ["high-value-buyer-push", eventId],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage>
      <AdminHeader
        title="高价值买家推送"
        description="当买家在展位产生高意向行为时，实时通知对应展商"
        breadcrumb={["活动", "高价值买家推送"]}
        actions={
          dirty ? (
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "保存中…" : "保存规则"}
            </Button>
          ) : null
        }
      />
      <AdminContent>
        {isLoading || !config ? (
          <p className="text-sm text-text-muted">加载中…</p>
        ) : (
          <div className="space-y-6">
            <SectionCard title="意向等级规则">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium">A 级 · 线索采集</p>
                    <p className="mt-1 text-sm text-text-muted">
                      买家在该展位完成线索采集（留资表单）时触发
                    </p>
                  </div>
                  <Switch
                    checked={config.a_level_on_lead_capture}
                    onCheckedChange={(v) => update("a_level_on_lead_capture", v)}
                  />
                </div>

                <div>
                  <Label htmlFor="scan-threshold">B 级 · 重复到访次数</Label>
                  <p className="mb-2 text-sm text-text-muted">
                    买家扫描同一展位达到此次数时触发 B 级推送
                  </p>
                  <Input
                    id="scan-threshold"
                    type="number"
                    min={2}
                    max={10}
                    className="max-w-[120px]"
                    value={config.b_level_scan_threshold}
                    onChange={(e) =>
                      update(
                        "b_level_scan_threshold",
                        Math.min(10, Math.max(2, Number(e.target.value) || 2)),
                      )
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="cooldown">推送冷却（分钟）</Label>
                  <p className="mb-2 text-sm text-text-muted">
                    同一买家对同一展位两次推送的最小间隔
                  </p>
                  <Input
                    id="cooldown"
                    type="number"
                    min={15}
                    max={1440}
                    className="max-w-[120px]"
                    value={config.cooldown_minutes}
                    onChange={(e) =>
                      update(
                        "cooldown_minutes",
                        Math.min(
                          1440,
                          Math.max(15, Number(e.target.value) || 60),
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="推送渠道">
              <div className="divide-y divide-border">
                <div className="flex items-start justify-between gap-6 py-4 first:pt-0">
                  <div>
                    <p className="text-sm font-medium">展商账号通知</p>
                    <p className="mt-1 text-sm text-text-muted">
                      推送至展位所属组织管理员的通知中心
                    </p>
                  </div>
                  <Switch
                    checked={config.notify_exhibitor}
                    onCheckedChange={(v) => update("notify_exhibitor", v)}
                  />
                </div>
                <div className="flex items-start justify-between gap-6 py-4 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">Feed 动态提醒</p>
                    <p className="mt-1 text-sm text-text-muted">
                      同步写入展商 AI 动态流
                    </p>
                  </div>
                  <Switch
                    checked={config.notify_feed}
                    onCheckedChange={(v) => update("notify_feed", v)}
                  />
                </div>
              </div>
            </SectionCard>

            <p className="text-xs text-text-muted">
              活动 ID：{eventId} · 关闭「功能模块」中的高价值买家推送后，规则将停止生效且管理入口隐藏
            </p>
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
