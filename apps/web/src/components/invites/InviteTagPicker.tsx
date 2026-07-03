"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ParticipantTagChips } from "@/components/participants/ParticipantTagChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizeParticipantTags,
  participantHasTag,
} from "@/lib/participant-tags";
import { cn } from "@/lib/utils";

/** 邀请流程快捷标签（展示中文，存标准值） */
export const INVITE_QUICK_TAGS = [
  { value: "VIP", label: "VIP" },
  { value: "Speaker", label: "演讲嘉宾" },
  { value: "Sponsor", label: "赞助商" },
  { value: "Media", label: "媒体" },
] as const;

type InviteTagPickerProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  label?: string;
  optional?: boolean;
};

export function InviteTagPicker({
  value,
  onChange,
  disabled,
  label = "身份标签",
  optional = true,
}: InviteTagPickerProps) {
  const [customTag, setCustomTag] = useState("");
  const tags = normalizeParticipantTags(value);

  function toggleQuickTag(tagValue: string) {
    if (disabled) return;
    if (participantHasTag(tags, tagValue)) {
      onChange(tags.filter((t) => !participantHasTag([t], tagValue)));
    } else {
      onChange(normalizeParticipantTags([...tags, tagValue]));
    }
  }

  function addCustomTag() {
    const trimmed = customTag.trim();
    if (!trimmed || disabled) return;
    onChange(normalizeParticipantTags([...tags, trimmed]));
    setCustomTag("");
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs text-text-muted">
        {label}
        {optional && "（可选）"}
      </Label>

      {tags.length > 0 && <ParticipantTagChips tags={tags} max={6} />}

      <div className="flex flex-wrap gap-2">
        {INVITE_QUICK_TAGS.map((tag) => {
          const active = participantHasTag(tags, tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              disabled={disabled}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-border-light bg-white text-text-muted hover:border-brand-blue/40 hover:bg-brand-blue-light/50",
              )}
              onClick={() => toggleQuickTag(tag.value)}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          value={customTag}
          disabled={disabled}
          placeholder="输入自定义标签，回车添加"
          className="h-9"
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTag();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          disabled={disabled || !customTag.trim()}
          onClick={addCustomTag}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
