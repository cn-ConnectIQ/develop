"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatRuleLabel } from "@/lib/form-config";
import type { LeadFormConfig } from "@/types/booth";
import { cn } from "@/lib/utils";

type ConditionalRulesPanelProps = {
  config: LeadFormConfig;
  onChange: (config: LeadFormConfig) => void;
};

export function ConditionalRulesPanel({
  config,
  onChange,
}: ConditionalRulesPanelProps) {
  const [open, setOpen] = useState(true);
  const rulesEnabled = config.rulesEnabled ?? true;

  return (
    <div className="rounded-xl border border-border-light bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold">条件显示规则</span>
        <div className="flex items-center gap-3">
          <Switch
            checked={rulesEnabled}
            onCheckedChange={(v) =>
              onChange({ ...config, rulesEnabled: v })
            }
            onClick={(e) => e.stopPropagation()}
          />
          <ChevronDown
            className={cn(
              "size-4 text-text-muted transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border-light px-4 py-3">
          {!rulesEnabled && (
            <p className="text-sm text-text-muted">条件规则已关闭</p>
          )}
          {rulesEnabled && (config.rules ?? []).length === 0 && (
            <p className="text-sm text-text-muted">暂无条件规则</p>
          )}
          {rulesEnabled &&
            (config.rules ?? []).map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-text-muted"
              >
                {formatRuleLabel(rule, config.fields)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
