"use client";

import {
  Bell,
  CheckSquare,
  ClipboardList,
  Cloud,
  Gift,
  MessageSquare,
  Star,
  ToggleLeft,
  Trophy,
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
  | "WORD_CLOUD"
  | "RATING"
  | "SURVEY"
  | "QNA"
  | "LOTTERY"
  | "ANNOUNCEMENT"
  | "QUIZ";

const TYPE_CARDS: Array<{
  type: InteractionCreateType;
  icon: typeof ToggleLeft;
  iconClass: string;
  label: string;
  desc: string;
  disabled?: boolean;
  highlight?: boolean;
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
    type: "WORD_CLOUD",
    icon: Cloud,
    iconClass: "text-cyan-500",
    label: "词云",
    desc: "关键词收集",
  },
  {
    type: "RATING",
    icon: Star,
    iconClass: "text-brand-gold",
    label: "评分",
    desc: "1-5 星",
  },
  {
    type: "SURVEY",
    icon: ClipboardList,
    iconClass: "text-brand-purple",
    label: "问卷",
    desc: "多题合一",
  },
  {
    type: "QNA",
    icon: MessageSquare,
    iconClass: "text-brand-green",
    label: "问答",
    desc: "收集问题",
  },
  {
    type: "LOTTERY",
    icon: Gift,
    iconClass: "text-brand-red text-[20px]",
    label: "抽奖",
    desc: "随机抽取",
    highlight: true,
  },
  {
    type: "ANNOUNCEMENT",
    icon: Bell,
    iconClass: "text-orange-500",
    label: "公告",
    desc: "推送消息",
  },
  {
    type: "QUIZ",
    icon: Trophy,
    iconClass: "text-brand-gold",
    label: "测验",
    desc: "coming-soon",
    disabled: true,
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
        <p className="mb-3 text-sm font-semibold">选择互动类型</p>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.type}
                type="button"
                disabled={card.disabled}
                onClick={() => {
                  if (card.disabled) return;
                  onSelect(card.type);
                  onOpenChange(false);
                }}
                className={cn(
                  "relative flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border-light bg-content-bg p-3 transition-colors",
                  !card.disabled &&
                    "hover:border-brand-blue hover:bg-brand-blue-light/20",
                  card.disabled && "cursor-not-allowed opacity-60",
                  card.highlight && "ring-1 ring-brand-red/20",
                )}
              >
                <Icon className={cn("size-5", card.iconClass)} />
                <span className="text-[12px] font-medium">{card.label}</span>
                {card.type === "QUIZ" ? (
                  <span className="rounded bg-gray-100 px-1 text-[8px] text-gray-400">
                    coming-soon
                  </span>
                ) : (
                  <span className="text-[10px] text-text-muted">{card.desc}</span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
