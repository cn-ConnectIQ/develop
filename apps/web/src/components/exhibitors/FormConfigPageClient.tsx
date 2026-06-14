"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AdminContent } from "@/components/admin/admin-header";
import { ConditionalRulesPanel } from "@/components/exhibitors/ConditionalRulesPanel";
import { FormConfigPreview } from "@/components/exhibitors/FormConfigPreview";
import { FormFieldList } from "@/components/exhibitors/FormFieldList";
import { MarketupConfigPanel } from "@/components/exhibitors/MarketupConfigPanel";
import {
  buildDefaultFieldMap,
  DEFAULT_MARKETUP_SYNC_CONFIG,
  SYSTEM_CAPTURE_FIELDS,
} from "@/lib/form-config";
import {
  DEFAULT_LEAD_FORM_CONFIG,
  type LeadFormConfig,
  type MarketupSyncConfig,
} from "@/types/booth";
import { cn } from "@/lib/utils";

type BoothOption = {
  id: string;
  code: string;
  name: string;
  exhibitor: { id: string; name: string };
};

type FormConfigData = {
  booth: {
    id: string;
    code: string;
    name: string;
    leadFormConfig: LeadFormConfig;
  };
  booths: BoothOption[];
  externalSync: {
    fieldMap: Record<string, string>;
    syncConfig: MarketupSyncConfig;
  };
  template: LeadFormConfig | null;
};

const ALL_BOOTHS = "__all__";

async function fetchFormConfig(eventId: string, boothId: string) {
  const res = await fetch(`/api/events/${eventId}/booths/${boothId}/form-config`);
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.data as FormConfigData;
}

export function FormConfigPageClient({
  eventId,
  boothId: initialBoothId,
}: {
  eventId: string;
  boothId: string;
}) {
  const queryClient = useQueryClient();
  const [selectedBoothId, setSelectedBoothId] = useState(initialBoothId);
  const [config, setConfig] = useState<LeadFormConfig>(DEFAULT_LEAD_FORM_CONFIG);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [syncConfig, setSyncConfig] = useState<MarketupSyncConfig>(
    DEFAULT_MARKETUP_SYNC_CONFIG,
  );
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyToAll = selectedBoothId === ALL_BOOTHS;
  const activeBoothId = applyToAll ? initialBoothId : selectedBoothId;

  const { data, isLoading } = useQuery({
    queryKey: ["form-config", eventId, activeBoothId],
    queryFn: () => fetchFormConfig(eventId, activeBoothId),
  });

  useEffect(() => {
    if (!data) return;
    setConfig(
      data.booth.leadFormConfig?.fields?.length
        ? data.booth.leadFormConfig
        : DEFAULT_LEAD_FORM_CONFIG,
    );
    setFieldMap(
      Object.keys(data.externalSync.fieldMap).length
        ? data.externalSync.fieldMap
        : buildDefaultFieldMap(
            data.booth.leadFormConfig?.fields?.length
              ? data.booth.leadFormConfig
              : DEFAULT_LEAD_FORM_CONFIG,
          ),
    );
    setSyncConfig(data.externalSync.syncConfig);
  }, [data]);

  const selectorLabel = useMemo(() => {
    if (applyToAll) return "为所有展商配置";
    const booth = data?.booths.find((b) => b.id === selectedBoothId);
    return booth
      ? `${booth.code} · ${booth.exhibitor.name}`
      : "选择展商展位";
  }, [applyToAll, data?.booths, selectedBoothId]);

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/events/${eventId}/booths/${activeBoothId}/form-config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadFormConfig: config,
            saveAsTemplate: true,
          }),
        },
      );
      if (!res.ok) throw new Error("保存模板失败");
    },
    onSuccess: () => toast.success("已另存为模板"),
    onError: () => toast.error("另存为模板失败"),
  });

  async function handleSave() {
    setSaving(true);
    const configToSave: LeadFormConfig = {
      ...config,
      fields: config.fields.map((field) => ({
        ...field,
        marketupField: fieldMap[field.id] ?? field.marketupField,
      })),
    };

    try {
      const res = await fetch(
        `/api/events/${eventId}/booths/${activeBoothId}/form-config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadFormConfig: configToSave,
            applyToAll,
          }),
        },
      );
      if (!res.ok) throw new Error("保存表单失败");

      const marketupRes = await fetch(`/api/events/${eventId}/marketup-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldMap, syncConfig }),
      });
      if (!marketupRes.ok) throw new Error("保存映射失败");

      setConfig(configToSave);
      void queryClient.invalidateQueries({
        queryKey: ["form-config", eventId],
      });
      toast.success("配置已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }
  const currentBoothCode = applyToAll
    ? undefined
    : data?.booths.find((b) => b.id === selectedBoothId)?.code;

  return (
    <AdminContent>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">采集表单配置</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
            <PopoverTrigger className="inline-flex h-9 min-w-[200px] items-center justify-between rounded-lg border border-border-light bg-white px-3 text-sm">
              <span className="truncate">{selectorLabel}</span>
              <ChevronDown className="ml-2 size-4 shrink-0 text-text-muted" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedBoothId(ALL_BOOTHS);
                  setSelectorOpen(false);
                }}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100",
                  applyToAll && "bg-brand-blue-light text-brand-blue",
                )}
              >
                为所有展商配置
              </button>
              {data?.booths.map((booth) => (
                <button
                  key={booth.id}
                  type="button"
                  onClick={() => {
                    setSelectedBoothId(booth.id);
                    setSelectorOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100",
                    selectedBoothId === booth.id &&
                      !applyToAll &&
                      "bg-brand-blue-light text-brand-blue",
                  )}
                >
                  <span className="font-mono text-brand-blue">{booth.code}</span>
                  <span className="ml-2 text-text-muted">{booth.exhibitor.name}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            disabled={saveTemplate.isPending}
            onClick={() => saveTemplate.mutate()}
          >
            另存为模板
          </Button>
          <Button
            className="bg-brand-blue hover:bg-brand-blue/90"
            disabled={saving || isLoading}
            onClick={handleSave}
          >
            {saving ? "保存中…" : "保存配置"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-border-light bg-gray-50 p-4">
            <p className="mb-3 text-xs text-text-muted">
              系统自动采集（不可修改）
            </p>
            <div className="space-y-2">
              {SYSTEM_CAPTURE_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center gap-2 text-sm text-text-muted"
                >
                  <Lock className="size-3.5 shrink-0" />
                  {field.label}
                </div>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <FormFieldList
              fields={config.fields}
              onChange={(fields) => setConfig({ ...config, fields })}
            />
          )}

          <ConditionalRulesPanel config={config} onChange={setConfig} />

          <MarketupConfigPanel
            config={config}
            fieldMap={fieldMap}
            syncConfig={syncConfig}
            onFieldMapChange={setFieldMap}
            onSyncConfigChange={setSyncConfig}
          />
        </div>

        <FormConfigPreview config={config} boothCode={currentBoothCode} />
      </div>
    </AdminContent>
  );
}
