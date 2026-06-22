"use client";

import { cn } from "@/lib/utils";
import {
  useBigscreenStore,
  type ProjectionTab,
} from "@/stores/bigscreenStore";

const TABS: { id: ProjectionTab; label: string }[] = [
  { id: "interaction", label: "互动" },
  { id: "booth_ranking", label: "展位排行" },
  { id: "network_heat", label: "网络热度" },
];

export function BigscreenTabBar() {
  const projectionTab = useBigscreenStore((s) => s.projectionTab);
  const setProjectionTab = useBigscreenStore((s) => s.setProjectionTab);

  return (
    <div className="absolute left-0 right-0 top-0 z-20 flex justify-center gap-2 px-10 pt-6">
      {TABS.map((tab) => (
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
