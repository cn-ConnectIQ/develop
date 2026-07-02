"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { LeadFormField, LeadFormUserPrefill } from "@/lib/lead-form/types";
import { buildPrefilledValues } from "@/lib/lead-form/prefill";
import { cn } from "@/lib/utils";

type LeadFormRendererProps = {
  fields: LeadFormField[];
  user?: LeadFormUserPrefill;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  loading?: boolean;
  className?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
};

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: LeadFormField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <Label className="text-xs font-medium">
      {field.label}
      {field.required && <span className="text-brand-red"> *</span>}
    </Label>
  );

  const placeholder = field.placeholder ?? `请输入${field.label}`;

  switch (field.type) {
    case "textarea":
      return (
        <div>
          {label}
          <Textarea
            className="mt-1.5 min-h-20 resize-none text-sm"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "select":
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
    case "multiselect": {
      let selected: string[] = [];
      if (value) {
        if (value.startsWith("[")) {
          try {
            const parsed = JSON.parse(value) as unknown;
            if (Array.isArray(parsed)) {
              selected = parsed.filter((v): v is string => typeof v === "string");
            }
          } catch {
            selected = value.split(",").filter(Boolean);
          }
        } else {
          selected = value.split(",").filter(Boolean);
        }
      }
      return (
        <div>
          {label}
          <div className="mt-2 space-y-2">
            {(field.options ?? []).map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => {
                      const set = new Set(selected);
                      if (next) set.add(opt);
                      else set.delete(opt);
                      onChange(JSON.stringify([...set]));
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    case "phone":
      return (
        <div>
          {label}
          <Input
            type="tel"
            className="mt-1.5 h-9 text-sm"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "email":
      return (
        <div>
          {label}
          <Input
            type="email"
            className="mt-1.5 h-9 text-sm"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    default:
      return (
        <div>
          {label}
          <Input
            className="mt-1.5 h-9 text-sm"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

export function LeadFormRenderer({
  fields,
  user,
  title = "填写信息参与抽奖",
  subtitle,
  submitLabel = "提交并参与",
  loading = false,
  className,
  onSubmit,
}: LeadFormRendererProps) {
  const initialValues = useMemo(
    () => buildPrefilledValues(fields, user ?? {}),
    [fields, user],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const sortedFields = useMemo(
    () =>
      [...fields].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      ),
    [fields],
  );

  return (
    <form
      className={cn("space-y-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      {(title || subtitle) && (
        <div className="text-center">
          {title && <p className="text-base font-semibold">{title}</p>}
          {subtitle && (
            <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
      )}

      {sortedFields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id] ?? ""}
          onChange={(v) =>
            setValues((prev) => ({
              ...prev,
              [field.id]: v,
            }))
          }
        />
      ))}

      <Button
        type="submit"
        className="w-full bg-brand-blue hover:bg-brand-blue/90"
        disabled={loading}
      >
        {loading ? "提交中…" : submitLabel}
      </Button>
    </form>
  );
}
