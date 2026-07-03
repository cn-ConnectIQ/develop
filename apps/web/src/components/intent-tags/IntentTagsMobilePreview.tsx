"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type IntentTagsMobilePreviewProps = {
  supply: string[];
  demand: string[];
  roles: string[];
  topics: string[];
  selectedSupply: string[];
  selectedDemand: string[];
  selectedRole: string | null;
  selectedTopics: string[];
  onToggleSupply: (tag: string) => void;
  onToggleDemand: (tag: string) => void;
  onSelectRole: (tag: string) => void;
  onToggleTopic: (tag: string) => void;
};

function PreviewChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-brand-blue bg-brand-blue text-white"
          : "border-gray-200 bg-white text-gray-600",
      )}
    >
      {label}
    </button>
  );
}

export function IntentTagsMobilePreview({
  supply,
  demand,
  roles,
  topics,
  selectedSupply,
  selectedDemand,
  selectedRole,
  selectedTopics,
  onToggleSupply,
  onToggleDemand,
  onSelectRole,
  onToggleTopic,
}: IntentTagsMobilePreviewProps) {
  return (
    <div className="hidden w-80 shrink-0 xl:block">
      <p className="mb-3 text-[10px] uppercase tracking-widest text-text-muted">
        参会者看到的效果（MT7）
      </p>
      <div className="mx-auto w-[220px]">
        <div className="aspect-[9/19.5] overflow-hidden rounded-[2rem] border-4 border-gray-800 bg-[#f7f8fa] shadow-lg">
          <div className="origin-top scale-[0.58]" style={{ width: 377 }}>
            <div className="bg-white px-4 pb-6 pt-10">
              <p className="text-[11px] text-gray-400">意向采集</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                告诉我们您的参会目标
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                标签越精准，AI 配对越准确
              </p>

              <div className="mt-5 space-y-4">
                <PreviewSection title="我能提供">
                  <div className="flex flex-wrap gap-1.5">
                    {(supply.length ? supply : ["暂无标签"]).map((tag) => (
                      <PreviewChip
                        key={`s-${tag}`}
                        label={tag}
                        active={selectedSupply.includes(tag)}
                        onClick={
                          supply.length
                            ? () => onToggleSupply(tag)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </PreviewSection>

                <PreviewSection title="我在寻找">
                  <div className="flex flex-wrap gap-1.5">
                    {(demand.length ? demand : ["暂无标签"]).map((tag) => (
                      <PreviewChip
                        key={`d-${tag}`}
                        label={tag}
                        active={selectedDemand.includes(tag)}
                        onClick={
                          demand.length
                            ? () => onToggleDemand(tag)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </PreviewSection>

                <PreviewSection title="我的角色">
                  <div className="flex flex-wrap gap-1.5">
                    {(roles.length ? roles : ["暂无角色"]).map((tag) => (
                      <PreviewChip
                        key={`r-${tag}`}
                        label={tag}
                        active={selectedRole === tag}
                        onClick={
                          roles.length ? () => onSelectRole(tag) : undefined
                        }
                      />
                    ))}
                  </div>
                </PreviewSection>

                <PreviewSection title="关注话题">
                  <div className="flex flex-wrap gap-1.5">
                    {(topics.length ? topics : ["暂无话题"]).map((tag) => (
                      <PreviewChip
                        key={`t-${tag}`}
                        label={tag}
                        active={selectedTopics.includes(tag)}
                        onClick={
                          topics.length ? () => onToggleTopic(tag) : undefined
                        }
                      />
                    ))}
                  </div>
                </PreviewSection>
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-xl bg-brand-blue py-2.5 text-sm font-medium text-white"
              >
                提交意向
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-700">{title}</p>
      {children}
    </div>
  );
}
