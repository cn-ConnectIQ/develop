"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";
import { IntentTagDimensionEditor } from "@/components/intent-tags/IntentTagDimensionEditor";
import { IntentTagsMobilePreview } from "@/components/intent-tags/IntentTagsMobilePreview";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_ROLE_TAG_OPTIONS,
  type IntentTagLibrary,
} from "@/lib/intent-tag-library";
import {
  INDUSTRY_INTENT_PRESETS,
  mergeTagLists,
  type IndustryPresetKey,
} from "@/lib/intent-tag-industry-presets";

type LibraryState = {
  supply: string[];
  demand: string[];
  roles: string[];
  topics: string[];
};

const EMPTY_LIBRARY: LibraryState = {
  supply: [],
  demand: [],
  roles: [...DEFAULT_ROLE_TAG_OPTIONS],
  topics: [],
};

async function fetchLibrary(eventId: string): Promise<LibraryState> {
  const res = await fetch(`/api/events/${eventId}/intent-tags`);
  if (!res.ok) throw new Error("加载标签库失败");
  const json = await res.json();
  const data = json.data as IntentTagLibrary;
  return {
    supply: data.supply ?? [],
    demand: data.demand ?? [],
    roles: data.roles?.length ? data.roles : [...DEFAULT_ROLE_TAG_OPTIONS],
    topics: data.topics ?? [],
  };
}

function libraryEquals(a: LibraryState, b: LibraryState) {
  return (
    JSON.stringify(a.supply) === JSON.stringify(b.supply) &&
    JSON.stringify(a.demand) === JSON.stringify(b.demand) &&
    JSON.stringify(a.roles) === JSON.stringify(b.roles) &&
    JSON.stringify(a.topics) === JSON.stringify(b.topics)
  );
}

export function IntentTagsManagementClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const { data: savedLibrary, isLoading } = useQuery({
    queryKey: ["event-intent-tag-library", eventId],
    queryFn: () => fetchLibrary(eventId),
  });

  const [library, setLibrary] = useState<LibraryState>(EMPTY_LIBRARY);
  const [industryKey, setIndustryKey] = useState<IndustryPresetKey | "">("");
  const [saving, setSaving] = useState(false);

  const [selectedSupply, setSelectedSupply] = useState<string[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  useEffect(() => {
    if (savedLibrary) setLibrary(savedLibrary);
  }, [savedLibrary]);

  const dirty = useMemo(() => {
    if (!savedLibrary) return false;
    return !libraryEquals(library, savedLibrary);
  }, [library, savedLibrary]);

  const patchLibrary = useCallback((patch: Partial<LibraryState>) => {
    setLibrary((prev) => ({ ...prev, ...patch }));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/intent-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(library),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "保存失败");
      }
      const data = json.data as IntentTagLibrary;
      const next: LibraryState = {
        supply: data.supply,
        demand: data.demand,
        roles: data.roles,
        topics: data.topics,
      };
      setLibrary(next);
      void queryClient.invalidateQueries({
        queryKey: ["event-intent-tag-library", eventId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["event-intent-tags", eventId],
      });
      toast.success("标签库已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function importIndustryTags(key: IndustryPresetKey) {
    const preset = INDUSTRY_INTENT_PRESETS.find((p) => p.key === key);
    if (!preset) return;

    patchLibrary({
      supply: mergeTagLists(library.supply, preset.supply),
      demand: mergeTagLists(library.demand, preset.demand),
      topics: mergeTagLists(library.topics, preset.topics),
    });
    toast.success(`已导入「${preset.label}」行业标签，可按需删减`);
  }

  function togglePreviewTag(
    current: string[],
    tag: string,
    setter: (next: string[]) => void,
  ) {
    setter(
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );
  }

  return (
    <AdminPageBody>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--admin-ink)]">
            意向标签管理
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            参会者在小程序填写意图时，从这里的标签库选择。标签越精准，AI
            配对越准确。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={industryKey}
            onValueChange={(value) => {
              const key = value as IndustryPresetKey;
              setIndustryKey(key);
              importIndustryTags(key);
              setIndustryKey("");
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="导入行业标签" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_INTENT_PRESETS.map((preset) => (
                <SelectItem key={preset.key} value={preset.key}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-brand-purple text-white hover:bg-brand-purple/90"
            disabled={!dirty || saving || isLoading}
            onClick={() => void handleSave()}
          >
            <Save className="mr-1.5 size-4" />
            {saving ? "保存中…" : "保存标签库"}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-text-muted">
              加载中…
            </p>
          ) : (
            <>
              <IntentTagDimensionEditor
                title="维度一 · 我能提供"
                description="这些是参会者可以选择来描述自己能力的标签"
                tags={library.supply}
                onChange={(supply) => patchLibrary({ supply })}
                chipClassName="border-brand-green/30 bg-brand-green-light text-brand-green"
              />

              <IntentTagDimensionEditor
                title="维度二 · 我在寻找"
                description="参会者希望对接的资源、客户或合作方向"
                tags={library.demand}
                onChange={(demand) => patchLibrary({ demand })}
                chipClassName="border-brand-blue/30 bg-brand-blue-light text-brand-blue"
              />

              <IntentTagDimensionEditor
                title="维度三 · 角色"
                description="系统默认含采购方/供应方/投资方等，可删除不适用的或新增（如媒体、政府）"
                tags={library.roles}
                onChange={(roles) => patchLibrary({ roles })}
                chipClassName="border-brand-purple/30 bg-brand-purple-light text-brand-purple"
              />

              <IntentTagDimensionEditor
                title="维度四 · 关注话题"
                description="用于话题重合度匹配，建议覆盖本次活动核心议题"
                tags={library.topics}
                onChange={(topics) => patchLibrary({ topics })}
              />

              <div className="rounded-xl border border-dashed border-border-light bg-white/60 p-4 text-xs text-text-muted">
                <div className="flex items-center gap-2 font-medium text-text-muted">
                  <Download className="size-3.5" />
                  快速导入说明
                </div>
                <p className="mt-2">
                  使用右上角「导入行业标签」可一次性追加科技/制造/金融/医疗/消费等常用标签，导入后与现有标签合并，不会覆盖您已配置的内容。
                </p>
              </div>
            </>
          )}
        </div>

        <IntentTagsMobilePreview
          supply={library.supply}
          demand={library.demand}
          roles={library.roles}
          topics={library.topics}
          selectedSupply={selectedSupply}
          selectedDemand={selectedDemand}
          selectedRole={selectedRole}
          selectedTopics={selectedTopics}
          onToggleSupply={(tag) =>
            togglePreviewTag(selectedSupply, tag, setSelectedSupply)
          }
          onToggleDemand={(tag) =>
            togglePreviewTag(selectedDemand, tag, setSelectedDemand)
          }
          onSelectRole={(tag) =>
            setSelectedRole(selectedRole === tag ? null : tag)
          }
          onToggleTopic={(tag) =>
            togglePreviewTag(selectedTopics, tag, setSelectedTopics)
          }
        />
      </div>
    </AdminPageBody>
  );
}
