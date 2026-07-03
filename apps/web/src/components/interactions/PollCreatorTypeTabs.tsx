"use client";

import { BarChart3, MessageCircleQuestion, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type PollCreatorTab = "vote" | "qna" | "rating";

const TABS: Array<{
  id: PollCreatorTab;
  label: string;
  icon: typeof BarChart3;
  pollTypes: string[];
}> = [
  { id: "vote", label: "投票", icon: BarChart3, pollTypes: ["SINGLE_CHOICE", "MULTI_CHOICE"] },
  { id: "qna", label: "问答", icon: MessageCircleQuestion, pollTypes: ["QNA"] },
  { id: "rating", label: "评分", icon: Star, pollTypes: ["RATING"] },
];

export function pollTypeToTab(type: string): PollCreatorTab {
  if (type === "QNA") return "qna";
  if (type === "RATING") return "rating";
  return "vote";
}

export function tabToPollType(tab: PollCreatorTab, multiChoice: boolean): string {
  if (tab === "qna") return "QNA";
  if (tab === "rating") return "RATING";
  return multiChoice ? "MULTI_CHOICE" : "SINGLE_CHOICE";
}

type PollCreatorTypeTabsProps = {
  activeTab: PollCreatorTab;
  onChange: (tab: PollCreatorTab) => void;
  disabled?: boolean;
};

export function PollCreatorTypeTabs({
  activeTab,
  onChange,
  disabled,
}: PollCreatorTypeTabsProps) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-xl border-2 px-5 text-base font-medium transition-colors",
            activeTab === id
              ? "border-brand-blue bg-brand-blue-light/20 text-brand-blue"
              : "border-border-light text-text-secondary hover:border-border-default hover:bg-content-bg/60",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}
