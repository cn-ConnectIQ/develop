"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FIXED_MARKETUP_MAP,
  MARKETUP_FIELD_OPTIONS,
  SYSTEM_CAPTURE_FIELDS,
} from "@/lib/form-config";
import type { LeadFormConfig, MarketupSyncConfig } from "@/types/booth";
import { cn } from "@/lib/utils";

type MarketupConfigPanelProps = {
  config: LeadFormConfig;
  fieldMap: Record<string, string>;
  syncConfig: MarketupSyncConfig;
  onFieldMapChange: (map: Record<string, string>) => void;
  onSyncConfigChange: (config: MarketupSyncConfig) => void;
};

export function MarketupConfigPanel({
  config,
  fieldMap,
  syncConfig,
  onFieldMapChange,
  onSyncConfigChange,
}: MarketupConfigPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl bg-brand-purple-light p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="font-semibold text-brand-purple">
          MarketUP CRM 字段映射
        </h3>
        <ChevronDown
          className={cn(
            "size-4 text-brand-purple transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-lg border border-brand-purple/10 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs text-text-muted">
                  <th className="p-3">ConnectIQ 字段</th>
                  <th className="p-3">MarketUP 字段</th>
                </tr>
              </thead>
              <tbody>
                {SYSTEM_CAPTURE_FIELDS.map((field) => (
                  <tr key={field.key} className="border-b bg-gray-50">
                    <td className="p-3">
                      <span className="flex items-center gap-1.5">
                        {field.label}
                        <Lock className="size-3 text-text-muted" />
                      </span>
                    </td>
                    <td className="p-3 text-text-muted">
                      {FIXED_MARKETUP_MAP[field.key] ?? fieldMap[field.key]}
                    </td>
                  </tr>
                ))}
                {config.fields.map((field) => (
                  <tr key={field.id} className="border-b last:border-0">
                    <td className="p-3">{field.label}</td>
                    <td className="p-3">
                      <Select
                        value={fieldMap[field.id] ?? field.marketupField ?? ""}
                        onValueChange={(v) => {
                          if (!v) return;
                          onFieldMapChange({ ...fieldMap, [field.id]: v });
                        }}
                      >
                        <SelectTrigger className="h-8 w-full max-w-[180px]">
                          <SelectValue placeholder="选择字段" />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKETUP_FIELD_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-lg bg-white/70 p-3">
            <p className="text-xs font-semibold text-brand-purple">
              自动化触发规则
            </p>
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm font-normal">
                A 级线索签到 → 立即分配销售
              </Label>
              <Switch
                checked={syncConfig.triggers.assignSalesOnA}
                onCheckedChange={(v) =>
                  onSyncConfigChange({
                    ...syncConfig,
                    triggers: { ...syncConfig.triggers, assignSalesOnA: v },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm font-normal">
                活动结束 → 启动培育序列
              </Label>
              <Switch
                checked={syncConfig.triggers.nurtureOnEnd}
                onCheckedChange={(v) =>
                  onSyncConfigChange({
                    ...syncConfig,
                    triggers: { ...syncConfig.triggers, nurtureOnEnd: v },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
