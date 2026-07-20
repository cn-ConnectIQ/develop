"use client";

import {
  Bell,
  CheckSquare,
  MessageSquare,
  Star,
  ToggleLeft,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type InteractionCreateType =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "RATING"
  | "QNA"
  | "ANNOUNCEMENT";

const TYPE_CARDS: Array<{
  type: InteractionCreateType;
  icon: typeof ToggleLeft;
  iconClass: string;
  label: string;
  desc: string;
}> = [
  {
    type: "SINGLE_CHOICE",
    icon: ToggleLeft,
    iconClass: "text-brand-blue",
    label: "单选",
    desc: "1个选项",
  },
  {
    type: "MULTI_CHOICE",
    icon: CheckSquare,
    iconClass: "text-brand-blue",
    label: "多选",
    desc: "多个选项",
  },
  {
    type: "RATING",
    icon: Star,
    iconClass: "text-brand-gold",
    label: "评分",
    desc: "1-5 星",
  },
  {
    type: "QNA",
    icon: MessageSquare,
    iconClass: "text-brand-green",
    label: "问答",
    desc: "收集问题",
  },
  {
    type: "ANNOUNCEMENT",
    icon: Bell,
    iconClass: "text-orange-500",
    label: "公告",
    desc: "推送消息",
  },
];

type InteractionTypePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: InteractionCreateType) => void;
  children: React.ReactNode;
};

export function InteractionTypePopover({
  open,
  onOpenChange,
  onSelect,
  children,
}: InteractionTypePopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger className="w-full">{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[320px] rounded-2xl border border-border-light bg-white p-4 shadow-lg"
      >
        <div className="grid grid-cols-2 gap-2">
          {TYPE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.type}
                type="button"
                onClick={() => {
                  onSelect(card.type);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border border-border-light bg-surface px-3 py-3 text-left transition-colors hover:border-brand-blue/40 hover:bg-brand-blue/5",
                )}
              >
                <Icon className={cn("size-4", card.iconClass)} />
                <span className="text-sm font-medium text-text-primary">
                  {card.label}
                </span>
                <span className="text-[11px] text-text-tertiary">
                  {card.desc}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
