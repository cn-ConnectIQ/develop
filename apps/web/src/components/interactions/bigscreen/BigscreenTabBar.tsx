"use client";

import { cn } from "@/lib/utils";
import {
  useBigscreenStore,
  type ProjectionTab,
} from "@/stores/bigscreenStore";

const ALL_TABS: { id: ProjectionTab; label: string; flag?: "speedNetworking" | "boothRanking" }[] = [
  { id: "interaction", label: "互动" },
  { id: "booth_ranking", label: "展位排行", flag: "boothRanking" },
  { id: "network_heat", label: "网络热度", flag: "speedNetworking" },
];

type BigscreenTabBarProps = {
  enabledFlags?: Partial<Record<"speedNetworking" | "boothRanking", boolean>>;
};

export function BigscreenTabBar({ enabledFlags }: BigscreenTabBarProps) {
  const projectionTab = useBigscreenStore((s) => s.projectionTab);
  const setProjectionTab = useBigscreenStore((s) => s.setProjectionTab);

  const tabs = ALL_TABS.filter((tab) => {
    if (!tab.flag) return true;
    if (!enabledFlags) return true;
    return enabledFlags[tab.flag] !== false;
  });

  if (tabs.length <= 1) return null;

  return (
    <div className="absolute left-0 right-0 top-0 z-20 flex justify-center gap-2 px-10 pt-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setProjectionTab(tab.id)}
          className={cn(
            "rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors",
            projectionTab === tab.id
              ? "border-b-2 border-brand-gold bg-white/20"
              : "bg-white/10 hover:bg-white/15",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
