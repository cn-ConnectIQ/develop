"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InteractionAnnouncementItem } from "@/lib/interaction-manager";
import { withPublicPath } from "@/lib/public-path";

type AnnouncementWorkspaceProps = {
  eventId: string;
  item: InteractionAnnouncementItem;
  onRefresh: () => void;
  onDelete: (item: InteractionAnnouncementItem) => void;
};

export function AnnouncementWorkspace({
  eventId,
  item,
  onRefresh,
  onDelete,
}: AnnouncementWorkspaceProps) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [isPinned, setIsPinned] = useState(item.isPinned);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setContent(item.content);
    setIsPinned(item.isPinned);
  }, [item.id, item.title, item.content, item.isPinned]);

  async function save() {
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent) {
      toast.error("标题和正文不能为空");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        withPublicPath(
          `/api/events/${eventId}/announcements/${item.id}`,
        ),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: nextTitle,
            content: nextContent,
            isPinned,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof json.error === "string" ? json.error : "保存失败",
        );
        return;
      }
      toast.success("公告已更新");
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">
            现场公告
          </p>
          <h2 className="mt-1 text-xl font-semibold text-text-primary">
            编辑并同步到参会端
          </h2>
          <p className="mt-1 text-[13px] text-text-tertiary">
            保存后立即对小程序 / 参会端公告列表生效。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-title">标题</Label>
          <Input
            id="ann-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：午场议程调整"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-content">正文</Label>
          <Textarea
            id="ann-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="公告内容…"
            rows={10}
            className="min-h-[200px] resize-y"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="size-4 rounded border-border"
          />
          置顶显示
        </label>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="text-[13px] text-brand-red hover:underline"
          >
            删除公告
          </button>
          <Button
            onClick={() => void save()}
            disabled={saving}
            className="bg-brand-green text-white hover:bg-brand-green/90"
          >
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
