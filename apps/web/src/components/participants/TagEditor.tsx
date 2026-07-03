"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PRESET_PARTICIPANT_TAGS,
  getTagLabel,
  normalizeParticipantTags,
  participantHasTag,
} from "@/lib/participant-tags";
import { cn } from "@/lib/utils";

export type TagEditorProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** append：仅展示待追加标签；replace：完整编辑 */
  mode?: "replace" | "append";
  disabled?: boolean;
  className?: string;
};

function isPresetTag(tag: string): boolean {
  return PRESET_PARTICIPANT_TAGS.some(
    (p) => p.toLowerCase() === tag.trim().toLowerCase(),
  );
}

export function TagEditor({
  value,
  onChange,
  mode = "replace",
  disabled,
  className,
}: TagEditorProps) {
  const [draft, setDraft] = useState("");
  const tags = normalizeParticipantTags(value);

  const customTags = useMemo(
    () => tags.filter((t) => !isPresetTag(t)),
    [tags],
  );

  function toggleTag(tag: string, checked: boolean) {
    if (disabled) return;
    if (checked) {
      onChange(normalizeParticipantTags([...tags, tag]));
    } else {
      onChange(tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    }
  }

  function addCustomTag() {
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;
    if (participantHasTag(tags, trimmed)) {
      setDraft("");
      return;
    }
    onChange(normalizeParticipantTags([...tags, trimmed]));
    setDraft("");
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label className="text-xs text-text-muted">系统预置标签</Label>
        <div className="mt-2 space-y-2">
          {PRESET_PARTICIPANT_TAGS.map((tag) => {
            const checked = participantHasTag(tags, tag);
            return (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => toggleTag(tag, !!v)}
                />
                <span>{getTagLabel(tag)}</span>
              </label>
            );
          })}
        </div>
      </div>

      {mode === "replace" && customTags.length > 0 && (
        <div>
          <Label className="text-xs text-text-muted">自定义标签</Label>
          <div className="mt-2 space-y-2">
            {customTags.map((tag) => (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={participantHasTag(tags, tag)}
                  disabled={disabled}
                  onCheckedChange={(v) => toggleTag(tag, !!v)}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs text-text-muted">
          {mode === "append" ? "追加自定义标签" : "+ 添加自定义标签"}
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            disabled={disabled}
            placeholder="如：政府嘉宾、特邀观察员"
            onChange={(e) => setDraft(e.target.value)}
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
            disabled={disabled || !draft.trim()}
            onClick={addCustomTag}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {mode === "append" && tags.length > 0 && (
        <p className="text-xs text-text-muted">
          将追加：{tags.map(getTagLabel).join("、")}
        </p>
      )}
    </div>
  );
}
