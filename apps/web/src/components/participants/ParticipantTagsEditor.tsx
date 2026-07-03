"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PRESET_PARTICIPANT_TAGS,
  getTagLabel,
  normalizeParticipantTags,
} from "@/lib/participant-tags";
import { cn } from "@/lib/utils";
import { ParticipantTagChips } from "@/components/participants/ParticipantTagChips";

type ParticipantTagsEditorProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ParticipantTagsEditor({
  value,
  onChange,
  disabled,
  compact,
}: ParticipantTagsEditorProps) {
  const [customTag, setCustomTag] = useState("");
  const tags = normalizeParticipantTags(value);

  function togglePreset(tag: string) {
    if (disabled) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange(tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    } else {
      onChange([...tags, tag]);
    }
  }

  function addCustomTag() {
    const trimmed = customTag.trim();
    if (!trimmed || disabled) return;
    onChange(normalizeParticipantTags([...tags, trimmed]));
    setCustomTag("");
  }

  function removeTag(tag: string) {
    if (disabled) return;
    onChange(tags.filter((t) => t !== tag));
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <ParticipantTagChips tags={tags} />
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PARTICIPANT_TAGS.map((tag) => {
            const active = tags.some(
              (t) => t.toLowerCase() === tag.toLowerCase(),
            );
            return (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                    : "border-border-light text-text-muted hover:bg-gray-50",
                )}
                onClick={() => togglePreset(tag)}
              >
                {getTagLabel(tag)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-text-muted">预置标签</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_PARTICIPANT_TAGS.map((tag) => {
            const active = tags.some(
              (t) => t.toLowerCase() === tag.toLowerCase(),
            );
            return (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                    : "border-border-light text-text-muted hover:bg-gray-50",
                )}
                onClick={() => togglePreset(tag)}
              >
                {getTagLabel(tag)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs text-text-muted">自定义标签</Label>
        <div className="mt-2 flex gap-2">
          <Input
            value={customTag}
            disabled={disabled}
            placeholder="如：政府嘉宾、媒体记者"
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
            disabled={disabled || !customTag.trim()}
            onClick={addCustomTag}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border-light bg-gray-50 px-2 py-0.5 text-xs"
            >
              {getTagLabel(tag)}
              {!disabled && (
                <button type="button" onClick={() => removeTag(tag)}>
                  <X className="size-3 text-text-muted" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
