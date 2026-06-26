"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/admin/admin-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { EventIntentConfig } from "@/lib/matchmaking-config";
import type { ApiMatchmakingConfig } from "@/lib/matchmaking-config-service";

const DAYS_OPTIONS = [3, 5, 7, 14, 21, 30];

type PremeetSettingsProps = {
  config: EventIntentConfig | null;
  meta: ApiMatchmakingConfig | null;
  premeetEnabled: boolean;
  onPremeetEnabledChange: (v: boolean) => void;
  onConfigChange: (config: EventIntentConfig) => void;
};

export function PremeetSettings({
  config,
  meta,
  premeetEnabled,
  onPremeetEnabledChange,
  onConfigChange,
}: PremeetSettingsProps) {
  const [local, setLocal] = useState<EventIntentConfig | null>(config);

  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  if (!local) return null;

  const openLabel = meta?.premeet_open_at_computed
    ? new Date(meta.premeet_open_at_computed).toLocaleString("zh-CN")
    : "未设置（需配置活动开始日期）";

  return (
    <SectionCard
      title="会前匹配预热"
      description="活动开始前开放 AI 匹配与会面预约，让参会者「带着目标来现场」"
    >
      <div className="flex items-start justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div>
          <p className="font-medium text-text">会前开放匹配</p>
          <p className="mt-1 text-sm text-text-muted">
            开启后，参会者激活即可看到推荐人脉、提前约会面
          </p>
          {premeetEnabled && (
            <p className="mt-2 text-xs text-primary">预计开放时间：{openLabel}</p>
          )}
        </div>
        <Switch checked={premeetEnabled} onCheckedChange={onPremeetEnabledChange} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>活动开始前开放（天）</Label>
          <Select
            value={String(local.premeet_days_before)}
            onValueChange={(v) => {
              const next = { ...local, premeet_days_before: Number(v) };
              setLocal(next);
              onConfigChange(next);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  开始前 {d} 天
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>或指定开放时间（可选）</Label>
          <Input
            type="datetime-local"
            defaultValue={
              meta?.premeet_open_at ? meta.premeet_open_at.slice(0, 16) : ""
            }
            onChange={(e) => {
              /* 保存时由父组件读取 */
            }}
            disabled
            title="保存后根据「开始前 X 天」自动计算；也可在 API 中指定 premeet_open_at"
          />
          <p className="text-xs text-text-muted">
            默认按活动开始日期倒推；保存配置后自动计算
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-text">预热提醒推送</p>
            <p className="text-sm text-text-muted">
              如活动前 3 天推送「X 位高匹配嘉宾已确认参加，去看看」
            </p>
          </div>
          <Switch
            checked={local.premeet_reminder_enabled}
            onCheckedChange={(v) => {
              const next = { ...local, premeet_reminder_enabled: v };
              setLocal(next);
              onConfigChange(next);
            }}
          />
        </div>

        {local.premeet_reminder_enabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>提醒提前天数</Label>
              <Select
                value={String(local.premeet_reminder_days)}
                onValueChange={(v) => {
                  const next = { ...local, premeet_reminder_days: Number(v) };
                  setLocal(next);
                  onConfigChange(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      活动前 {d} 天
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>推送文案模板</Label>
              <Input
                value={local.premeet_reminder_message}
                onChange={(e) => {
                  const next = { ...local, premeet_reminder_message: e.target.value };
                  setLocal(next);
                  onConfigChange(next);
                }}
                placeholder="{match_count} 位高匹配嘉宾已确认参加，去看看"
              />
              <p className="text-xs text-text-muted">
                可用变量：<code className="text-primary">{"{match_count}"}</code>
              </p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
