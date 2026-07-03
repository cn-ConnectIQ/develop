"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { ParticipantTagChips } from "@/components/participants/ParticipantTagChips";
import { TagEditor } from "@/components/participants/TagEditor";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ParticipantTagEditPopoverProps = {
  eventId: string;
  participantId: string;
  tags: string[];
  onSaved?: () => void;
  /** 仅展示 chip，隐藏编辑按钮 */
  readOnly?: boolean;
};

export function ParticipantTagEditPopover({
  eventId,
  participantId,
  tags,
  onSaved,
  readOnly,
}: ParticipantTagEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [editTags, setEditTags] = useState(tags);
  const [saving, setSaving] = useState(false);

  async function saveTags() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/participants/${participantId}/tags`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: editTags }),
        },
      );
      if (!res.ok) {
        toast.error("保存标签失败");
        return;
      }
      toast.success("标签已更新");
      setOpen(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) {
    return <ParticipantTagChips tags={tags} max={4} />;
  }

  return (
    <div className="flex items-center gap-1">
      <ParticipantTagChips tags={tags} max={3} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setEditTags(tags);
        }}
      >
        <PopoverTrigger className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-brand-blue">
          <Pencil className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <p className="mb-3 text-sm font-medium">编辑身份标签</p>
          <TagEditor
            value={editTags}
            onChange={setEditTags}
            mode="replace"
            disabled={saving}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void saveTags()}>
              确认
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
