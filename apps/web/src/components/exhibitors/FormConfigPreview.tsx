"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isFieldVisible, SYSTEM_CAPTURE_FIELDS } from "@/lib/form-config";
import type { LeadFormConfig, LeadFormField } from "@/types/booth";
import { cn } from "@/lib/utils";

type FormConfigPreviewProps = {
  config: LeadFormConfig;
  boothCode?: string;
};

function PreviewField({
  field,
  value,
  onChange,
}: {
  field: LeadFormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = (
    <Label className="text-xs font-medium">
      {field.label}
      {field.required && <span className="text-brand-red"> *</span>}
    </Label>
  );

  switch (field.type) {
    case "textarea":
      return (
        <div>
          {label}
          <Textarea
            className="mt-1.5 min-h-16 resize-none text-sm"
            placeholder={`请输入${field.label}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "select":
    case "multiselect":
      return (
        <div>
          {label}
          <Select
            value={value || undefined}
            onValueChange={(v) => onChange(v ?? "")}
          >
            <SelectTrigger className="mt-1.5 h-9 w-full text-sm">
              <SelectValue placeholder={`请选择${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <Input
            type="number"
            className="mt-1.5 h-9 text-sm"
            placeholder={`请输入${field.label}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "rating":
      return (
        <div>
          {label}
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                className={cn(
                  "size-8 rounded-lg border text-sm transition-colors",
                  Number(value) >= n
                    ? "border-brand-amber bg-brand-amber-light text-brand-amber"
                    : "border-border-light bg-gray-50 text-text-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div>
          {label}
          <Input
            className="mt-1.5 h-9 text-sm"
            placeholder={`请输入${field.label}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

export function FormConfigPreview({ config, boothCode }: FormConfigPreviewProps) {
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({
    intent: "有意向",
  });

  const visibleFields = useMemo(
    () =>
      config.fields.filter((field) =>
        isFieldVisible(
          field.id,
          config,
          previewValues,
          config.rulesEnabled ?? true,
        ),
      ),
    [config, previewValues],
  );

  return (
    <div className="sticky top-6">
      <h3 className="mb-4 text-sm font-semibold">展商扫码后看到的表单</h3>
      <div className="mx-auto w-[375px] overflow-hidden rounded-3xl border-8 border-gray-800 bg-white shadow-xl">
        <div className="bg-gray-800 px-4 py-2 text-center">
          <div className="mx-auto h-1 w-16 rounded-full bg-gray-600" />
        </div>
        <div className="max-h-[640px] overflow-y-auto p-5">
          <div className="mb-4 text-center">
            <p className="text-xs text-text-muted">展位采集</p>
            <p className="text-base font-semibold">
              {boothCode ? `展位 ${boothCode}` : "访客信息采集"}
            </p>
          </div>

          <div className="space-y-3.5">
            {SYSTEM_CAPTURE_FIELDS.map((field) => (
              <div key={field.key}>
                <Label className="text-xs font-medium text-text-muted">
                  {field.label}
                  <span className="ml-1 text-[10px]">（自动识别）</span>
                </Label>
                <div className="mt-1.5 h-9 rounded-lg border border-border-light bg-gray-50 px-3 text-sm leading-9 text-text-muted">
                  扫码自动填充
                </div>
              </div>
            ))}

            {visibleFields.map((field) => (
              <PreviewField
                key={field.id}
                field={field}
                value={previewValues[field.id] ?? ""}
                onChange={(v) =>
                  setPreviewValues((prev) => ({ ...prev, [field.id]: v }))
                }
              />
            ))}
          </div>

          <Button className="mt-6 w-full bg-brand-blue hover:bg-brand-blue/90" size="sm">
            提交线索
          </Button>
        </div>
      </div>
    </div>
  );
}
