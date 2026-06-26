"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EventIntentConfig } from "@/lib/matchmaking-config";

type IntentTagRow = {
  id: string;
  label: string;
  pool: string;
};

const POOL_LABELS: Record<string, string> = {
  SUPPLY: "我能提供",
  DEMAND: "我在寻找",
  TOPIC: "关注话题",
  GENERAL: "通用",
};

const PRESET_TAGS: Record<string, string[]> = {
  SUPPLY: ["ERP 方案", "SaaS 产品", "云计算", "AI 落地", "MarTech"],
  DEMAND: ["ERP 方案", "CRM 系统", "营销自动化", "数据治理", "AI 落地"],
  TOPIC: ["AI 落地", "出海增长", "PLG", "智能制造", "数字化"],
};

type IntentFormBuilderProps = {
  eventId: string;
  config: EventIntentConfig | null;
  tags: IntentTagRow[];
  loading: boolean;
  onConfigChange: (config: EventIntentConfig) => void;
  onTagsChange: (tags: IntentTagRow[]) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
};

export function IntentFormBuilder({
  eventId,
  config,
  tags,
  loading,
  onConfigChange,
  onTagsChange,
  onSave,
  saving,
  dirty,
}: IntentFormBuilderProps) {
  const [localConfig, setLocalConfig] = useState<EventIntentConfig | null>(config);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagPool, setNewTagPool] = useState<"SUPPLY" | "DEMAND" | "TOPIC">("SUPPLY");
  const [newRole, setNewRole] = useState("");

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  const patchConfig = useCallback(
    (patch: Partial<EventIntentConfig>) => {
      if (!localConfig) return;
      const next = { ...localConfig, ...patch };
      setLocalConfig(next);
      onConfigChange(next);
    },
    [localConfig, onConfigChange],
  );

  const addTag = async (label: string, pool: "SUPPLY" | "DEMAND" | "TOPIC") => {
    const res = await fetch(`/api/events/${eventId}/intent-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, pool }),
    });
    if (!res.ok) {
      toast.error("添加标签失败");
      return;
    }
    const json = await res.json();
    onTagsChange([...tags, { id: json.data.id, label: json.data.label, pool: json.data.pool }]);
    toast.success("标签已添加");
  };

  const removeTag = async (tagId: string) => {
    const res = await fetch(`/api/events/${eventId}/intent-tags/${tagId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("删除失败");
      return;
    }
    onTagsChange(tags.filter((t) => t.id !== tagId));
  };

  const applyPresetPack = async (pool: "SUPPLY" | "DEMAND" | "TOPIC") => {
    const presets = PRESET_TAGS[pool] ?? [];
    for (const label of presets) {
      if (tags.some((t) => t.label === label && t.pool === pool)) continue;
      await addTag(label, pool);
    }
  };

  if (loading && !localConfig) {
    return (
      <SectionCard title="意图采集表单" description="加载中…">
        <p className="text-sm text-text-muted">正在加载…</p>
      </SectionCard>
    );
  }

  if (!localConfig) return null;

  return (
    <SectionCard
      title="意图采集表单"
      description="配置参会者报名/激活时需填写的意图维度，驱动双向匹配"
      action={
        dirty ? (
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            {saving ? "保存中…" : "保存配置"}
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {(
          [
            ["supply", "我能提供（供给）", "参会者可多选标签 + 自定义输入"],
            ["demand", "我在寻找（需求）", "与供给标签双向匹配的核心维度"],
            ["role", "我的角色", "采购 / 销售 / 投资 / 合作等"],
            ["topics", "关注的话题/领域", "用于话题重合度匹配"],
          ] as const
        ).map(([key, title, desc]) => {
          const field = localConfig[key];
          return (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
            >
              <div>
                <p className="font-medium text-text">{title}</p>
                <p className="mt-1 text-sm text-text-muted">{desc}</p>
                {key === "role" && "options" in field && field.enabled && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {field.options.map((opt) => (
                      <span
                        key={opt}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                      >
                        {opt}
                        <button
                          type="button"
                          className="text-text-tertiary hover:text-destructive"
                          onClick={() =>
                            patchConfig({
                              role: {
                                ...localConfig.role,
                                options: field.options.filter((o) => o !== opt),
                              },
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-7 w-24 text-xs"
                        placeholder="新角色"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => {
                          if (!newRole.trim()) return;
                          patchConfig({
                            role: {
                              ...localConfig.role,
                              options: [...field.options, newRole.trim()],
                            },
                          });
                          setNewRole("");
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {key !== "role" && "allow_custom" in field && field.enabled && (
                  <p className="mt-2 text-xs text-text-tertiary">
                    {field.allow_custom ? "允许自定义标签" : "仅可选预设标签"}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={field.enabled}
                  onCheckedChange={(v) => {
                    if (key === "role") {
                      patchConfig({ role: { ...localConfig.role, enabled: v } });
                    } else if (key === "supply") {
                      patchConfig({ supply: { ...localConfig.supply, enabled: v } });
                    } else if (key === "demand") {
                      patchConfig({ demand: { ...localConfig.demand, enabled: v } });
                    } else {
                      patchConfig({ topics: { ...localConfig.topics, enabled: v } });
                    }
                  }}
                />
                {key !== "role" && "allow_custom" in field && (
                  <label className="flex items-center gap-2 text-xs text-text-muted">
                    <Switch
                      checked={field.allow_custom}
                      disabled={!field.enabled}
                      onCheckedChange={(v) => {
                        if (key === "supply") {
                          patchConfig({ supply: { ...localConfig.supply, allow_custom: v } });
                        } else if (key === "demand") {
                          patchConfig({ demand: { ...localConfig.demand, allow_custom: v } });
                        } else {
                          patchConfig({ topics: { ...localConfig.topics, allow_custom: v } });
                        }
                      }}
                    />
                    自定义
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-medium text-text">活动意图标签库</h4>
            <p className="text-sm text-text-muted">
              科技展会用 AI/SaaS，医疗展可换另一套 — 参会者多选这些标签填写意图
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void applyPresetPack("SUPPLY")}
            >
              导入科技供给包
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void applyPresetPack("DEMAND")}
            >
              导入科技需求包
            </Button>
          </div>
        </div>

        {(["SUPPLY", "DEMAND", "TOPIC"] as const).map((pool) => {
          const poolTags = tags.filter((t) => t.pool === pool);
          return (
            <div key={pool} className="mb-4">
              <Label className="text-xs text-text-muted">{POOL_LABELS[pool]}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {poolTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-sm"
                  >
                    {tag.label}
                    <button
                      type="button"
                      className="text-text-tertiary hover:text-destructive"
                      onClick={() => void removeTag(tag.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {poolTags.length === 0 && (
                  <span className="text-xs text-text-muted">暂无标签</span>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">新增标签</Label>
            <Input
              placeholder="如 AI 落地"
              value={newTagLabel}
              onChange={(e) => setNewTagLabel(e.target.value)}
              className="w-40"
            />
          </div>
          <select
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={newTagPool}
            onChange={(e) =>
              setNewTagPool(e.target.value as "SUPPLY" | "DEMAND" | "TOPIC")
            }
          >
            <option value="SUPPLY">我能提供</option>
            <option value="DEMAND">我在寻找</option>
            <option value="TOPIC">关注话题</option>
          </select>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!newTagLabel.trim()) return;
              void addTag(newTagLabel.trim(), newTagPool).then(() => setNewTagLabel(""));
            }}
          >
            添加
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-muted/30 p-4 text-sm text-text-muted">
        <p className="font-medium text-text">匹配可解释性示例</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>你寻找 ERP 方案 ↔ TA 提供 ERP</li>
          <li>你们都关注 AI 落地</li>
          <li>TA 寻找 增长方法论 ↔ 你提供 增长方法论</li>
        </ul>
      </div>
    </SectionCard>
  );
}
