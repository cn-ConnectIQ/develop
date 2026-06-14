"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bot, Lock, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdminContent } from "@/components/admin/admin-header";
import {
  CUSTOM_FIELD_LABELS,
  DEFAULT_CUSTOM_FIELD_MAP,
  MARKETUP_TARGET_FIELDS,
} from "@/lib/marketup-config";
import type { MarketupSyncConfig } from "@/types/booth";
import { cn } from "@/lib/utils";

const FIXED_ROWS = [
  { key: "name", label: "姓名", target: "联系人姓名" },
  { key: "phone", label: "手机", target: "手机号" },
  { key: "company", label: "公司", target: "公司名称" },
] as const;

const DEFAULT_CONFIG: MarketupSyncConfig = {
  writeStrategy: "upsert",
  conflictPolicy: "connectiq",
  triggers: {
    welcomeEmail: true,
    assignSalesOnA: true,
    nurtureOnEnd: true,
  },
};

type SyncStats = {
  contacts: number;
  opportunities: number;
  failed: number;
  failures: Array<{
    id: string;
    leadId: string;
    participantName: string;
    errorMessage: string;
    attemptedAt: string;
  }>;
};

type ConfigData = {
  fieldMap: Record<string, string>;
  config: MarketupSyncConfig;
};

function RadioOption({
  checked,
  label,
  onSelect,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        className="size-4 accent-brand-blue"
      />
      {label}
    </label>
  );
}

export function MarketupPageClient() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["marketup-status"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/marketup/status");
      if (!res.ok) throw new Error("加载失败");
      return (await res.json()).data as SyncStats;
    },
    refetchInterval: 30000,
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["marketup-config"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/marketup/config");
      if (!res.ok) throw new Error("加载失败");
      return (await res.json()).data as ConfigData;
    },
  });

  const fieldMap = configData?.fieldMap ?? DEFAULT_CUSTOM_FIELD_MAP;
  const config = configData?.config ?? DEFAULT_CONFIG;

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      fieldMap: Record<string, string>;
      config: MarketupSyncConfig;
    }) => {
      const res = await fetch("/api/integrations/marketup/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("保存失败");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketup-config"] });
      toast.success("配置已保存");
    },
    onError: () => toast.error("保存失败"),
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch("/api/integrations/marketup/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error("重试失败");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketup-status"] });
      toast.success("已重新同步");
    },
    onError: () => toast.error("重试失败"),
  });

  function updateFieldMap(next: Record<string, string>) {
    queryClient.setQueryData(["marketup-config"], (old: ConfigData | undefined) => ({
      fieldMap: next,
      config: old?.config ?? DEFAULT_CONFIG,
    }));
  }

  function updateConfig(next: MarketupSyncConfig) {
    queryClient.setQueryData(["marketup-config"], (old: ConfigData | undefined) => ({
      fieldMap: old?.fieldMap ?? DEFAULT_CUSTOM_FIELD_MAP,
      config: next,
    }));
  }

  function removeCustomField(key: string) {
    const next = { ...fieldMap };
    delete next[key];
    updateFieldMap(next);
  }

  function addCustomField() {
    const id = `custom_${Date.now()}`;
    updateFieldMap({
      ...fieldMap,
      [id]: MARKETUP_TARGET_FIELDS[0],
    });
  }

  const customEntries = Object.entries(fieldMap).filter(
    ([key]) => !FIXED_ROWS.some((r) => r.key === key),
  );

  return (
    <AdminContent>
      <h1 className="text-xl font-bold">MarketUP CRM 集成</h1>
      <p className="mb-6 text-sm text-text-muted">
        配置 ConnectIQ 与 MarketUP 之间的字段映射、写入策略与同步监控
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 左侧 — 字段映射 */}
        <div className="rounded-xl border border-border-light bg-white p-6">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-brand-purple">
            <Bot className="size-5" />
            字段映射规则
          </h2>
          <p className="mb-4 text-xs text-text-muted">
            ConnectIQ 采集的数据写入 MarketUP 的哪个字段
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-text-muted">
                <th className="pb-2 font-medium">ConnectIQ 字段</th>
                <th className="pb-2 font-medium">MarketUP 字段</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {FIXED_ROWS.map((row) => (
                <tr key={row.key} className="border-b bg-gray-50">
                  <td className="py-2.5">{row.label}</td>
                  <td className="py-2.5 text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      {row.target}
                      <Lock className="size-3" />
                      <span className="text-[10px]">系统</span>
                    </span>
                  </td>
                  <td className="py-2.5" />
                </tr>
              ))}

              {customEntries.map(([key, target]) => (
                <tr key={key} className="border-b">
                  <td className="py-2.5">
                    {CUSTOM_FIELD_LABELS[key] ?? key}
                  </td>
                  <td className="py-2.5">
                    <Select
                      value={target}
                      onValueChange={(v) => {
                        if (!v) return;
                        updateFieldMap({ ...fieldMap, [key]: v });
                      }}
                    >
                      <SelectTrigger className="h-8 w-full max-w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKETUP_TARGET_FIELDS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeCustomField(key)}
                      className="rounded p-1 text-text-muted hover:bg-gray-100 hover:text-brand-red"
                      aria-label="删除映射"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={addCustomField}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-light py-2.5 text-sm text-text-muted transition-colors hover:border-brand-purple/40 hover:text-brand-purple"
          >
            <Plus className="size-4" />
            添加映射规则
          </button>

          <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
            <div>
              <Label className="mb-2 block text-xs font-semibold">写入策略</Label>
              <div className="space-y-2">
                <RadioOption
                  checked={config.writeStrategy === "create_only"}
                  label="仅新建联系人"
                  onSelect={() =>
                    updateConfig({ ...config, writeStrategy: "create_only" })
                  }
                />
                <RadioOption
                  checked={config.writeStrategy === "upsert"}
                  label="新建 + 更新已有（手机号匹配）"
                  onSelect={() =>
                    updateConfig({ ...config, writeStrategy: "upsert" })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs font-semibold">冲突处理</Label>
              <div className="space-y-2">
                <RadioOption
                  checked={config.conflictPolicy === "connectiq"}
                  label="以 ConnectIQ 为准"
                  onSelect={() =>
                    updateConfig({ ...config, conflictPolicy: "connectiq" })
                  }
                />
                <RadioOption
                  checked={config.conflictPolicy === "marketup"}
                  label="以 MarketUP 为准"
                  onSelect={() =>
                    updateConfig({ ...config, conflictPolicy: "marketup" })
                  }
                />
              </div>
            </div>
          </div>

          <Button
            className="mt-4 bg-brand-blue hover:bg-brand-blue/90"
            disabled={saveMutation.isPending || configLoading}
            onClick={() =>
              saveMutation.mutate({ fieldMap, config })
            }
          >
            {saveMutation.isPending ? "保存中…" : "保存映射配置"}
          </Button>
        </div>

        {/* 右侧 — 同步监控 */}
        <div className="rounded-xl border border-border-light bg-white p-6">
          <h2 className="mb-4 font-semibold">同步状态监控</h2>

          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="写入联系人"
              value={stats?.contacts ?? 0}
              loading={statsLoading}
              className="text-brand-green"
            />
            <StatTile
              label="写入商机"
              value={stats?.opportunities ?? 0}
              loading={statsLoading}
              className="text-brand-blue"
            />
            <StatTile
              label="同步失败"
              value={stats?.failed ?? 0}
              loading={statsLoading}
              className="text-brand-red"
              badge={stats?.failed ? stats.failed : undefined}
            />
          </div>

          {(stats?.failures?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-lg border border-brand-red-light bg-brand-red-light p-4">
              <p className="mb-3 font-semibold text-brand-red">
                ⚠ 同步失败记录
              </p>
              <ul className="space-y-3">
                {stats!.failures.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.participantName}</p>
                      <p className="text-xs text-text-muted">
                        {format(new Date(item.attemptedAt), "MM-dd HH:mm")} ·{" "}
                        {item.errorMessage}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(item.id)}
                    >
                      <RefreshCw
                        className={cn(
                          "mr-1 size-3",
                          retryMutation.isPending && "animate-spin",
                        )}
                      />
                      重试
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">自动化触发规则</h3>
            {(
              [
                ["welcomeEmail", "签到后触发欢迎邮件序列"],
                ["assignSalesOnA", "A 级线索到达 → 立即分配销售"],
                ["nurtureOnEnd", "活动结束 → 启动培育序列"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg border border-border-light px-3 py-2.5"
              >
                <span className="text-sm">{label}</span>
                <Switch
                  checked={config.triggers[key]}
                  onCheckedChange={(v) =>
                    updateConfig({
                      ...config,
                      triggers: { ...config.triggers, [key]: v },
                    })
                  }
                />
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ fieldMap, config })}
          >
            保存触发规则
          </Button>
        </div>
      </div>
    </AdminContent>
  );
}

function StatTile({
  label,
  value,
  loading,
  className,
  badge,
}: {
  label: string;
  value: number;
  loading?: boolean;
  className?: string;
  badge?: number;
}) {
  return (
    <div className="relative rounded-xl border border-border-light bg-gray-50 p-4 text-center">
      {badge != null && badge > 0 && (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <p className={cn("text-2xl font-bold tabular-nums", className)}>
        {loading ? "—" : value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-text-muted">{label}</p>
    </div>
  );
}
