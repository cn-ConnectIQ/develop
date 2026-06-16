"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { MemberTier } from "@connectiq/database";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { OrgMemberListItem } from "@/lib/org-member-service";
import { JoinSourceBadge, TierBadge } from "@/lib/member-utils";
import { cn } from "@/lib/utils";

type MemberDetail = {
  member: OrgMemberListItem;
  user: { email: string; industry: string | null };
  participationHistory: Array<{
    eventId: string;
    eventName: string;
    eventType: string;
    participatedAt: string;
    source: string;
  }>;
  participationSummary: { total: number; firstAt: string };
  orgTags: string[];
};

type MemberDetailSheetProps = {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function MemberDetailSheet({
  userId,
  open,
  onOpenChange,
  onUpdated,
}: MemberDetailSheetProps) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<MemberTier>("REGULAR");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/org/members/${userId}`);
      if (!res.ok) throw new Error("加载失败");
      const json = await res.json();
      const data = json.data as MemberDetail;
      setDetail(data);
      setTier(data.member.tier);
      setTags(data.member.tags);
      setNotes(data.member.notes ?? "");
    } catch {
      toast.error("无法加载用户详情");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) void loadDetail();
    if (!open) setDetail(null);
  }, [open, userId, loadDetail]);

  async function patchMember(payload: Record<string, unknown>) {
    if (!userId) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/org/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("保存失败");
      onUpdated();
      return true;
    } catch {
      toast.error("保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleTierChange(value: MemberTier) {
    setTier(value);
    const ok = await patchMember({ tier: value });
    if (ok) toast.success("层级已更新");
  }

  async function handleNotesBlur() {
    if (!detail || notes === (detail.member.notes ?? "")) return;
    const ok = await patchMember({ notes: notes || null });
    if (ok) toast.success("备注已保存");
  }

  async function saveTags(nextTags: string[]) {
    setTags(nextTags);
    const ok = await patchMember({ tags: nextTags });
    if (ok) toast.success("标签已更新");
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) return;
    void saveTags([...tags, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    void saveTags(tags.filter((t) => t !== tag));
  }

  async function handleMarketupExport() {
    if (!userId) return;
    const res = await fetch(`/api/org/members/${userId}/export-marketup`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "导出失败");
      return;
    }
    toast.success("已加入 MarketUP 导出队列");
  }

  async function handleRemove() {
    if (!userId) return;
    const res = await fetch(`/api/org/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("移除失败");
      return;
    }
    toast.success("已从用户池移除");
    setRemoveOpen(false);
    onOpenChange(false);
    onUpdated();
  }

  const member = detail?.member;
  const suggestedTags =
    detail?.orgTags.filter((t) => !tags.includes(t) && t.includes(tagInput)) ??
    [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>用户详情</SheetTitle>
          </SheetHeader>

          {loading && (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-brand-blue" />
            </div>
          )}

          {!loading && member && (
            <div className="mt-4 space-y-6 pb-8">
              <div className="rounded-xl bg-content p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="size-16">
                    <AvatarFallback className="text-lg">
                      {member.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-[var(--admin-ink)]">
                      {member.name}
                    </h2>
                    <p className="text-sm text-text-muted">
                      {[member.company, member.jobTitle].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <JoinSourceBadge source={member.joinSource} />
                      <TierBadge tier={tier} />
                      {member.isFollowing ? (
                        <span className="text-xs text-brand-green">已关注 ✓</span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-[var(--admin-ink)]">
                  参与历史
                </h3>
                <ul className="space-y-3">
                  {detail.participationHistory.length === 0 && (
                    <li className="text-sm text-text-muted">暂无参与记录</li>
                  )}
                  {detail.participationHistory.map((item) => (
                    <li
                      key={`${item.eventId}-${item.participatedAt}`}
                      className="rounded-lg border border-border-light px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{item.eventName}</p>
                        <span className="shrink-0 rounded bg-content-bg px-1.5 py-0.5 text-[10px] text-text-muted">
                          {item.eventType === "EXPO" ? "展会" : "会议"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {format(new Date(item.participatedAt), "yyyy-MM-dd HH:mm", {
                          locale: zhCN,
                        })}
                        · {item.source}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-text-muted">
                  共参与 {detail.participationSummary.total} 次 · 第一次：
                  {format(new Date(detail.participationSummary.firstAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })}
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                  管理员操作
                </h3>

                <div className="space-y-2">
                  <Label>层级设置</Label>
                  <Select
                    value={tier}
                    onValueChange={(v) => void handleTierChange(v as MemberTier)}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIP">VIP</SelectItem>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="REGULAR">REGULAR</SelectItem>
                      <SelectItem value="DORMANT">DORMANT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>自定义标签</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex h-6 items-center gap-1 rounded bg-brand-blue-light px-2 text-xs text-brand-blue"
                      >
                        {tag}
                        <button
                          type="button"
                          className="hover:text-brand-red"
                          onClick={() => removeTag(tag)}
                          aria-label={`删除标签 ${tag}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="输入标签，回车添加"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                    />
                    {tagInput && suggestedTags.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-md border border-border-light bg-white py-1 shadow-sm">
                        {suggestedTags.slice(0, 5).map((tag) => (
                          <li key={tag}>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-content"
                              onClick={() => addTag(tag)}
                            >
                              {tag}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-notes">管理员备注</Label>
                  <Textarea
                    id="member-notes"
                    rows={4}
                    placeholder="备注（用户看不到）"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => void handleNotesBlur()}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                  联系操作
                </h3>
                <Button
                  className="h-10 w-full bg-brand-blue text-white hover:bg-brand-blue/90"
                  onClick={() => toast.info("定向通知功能即将开放")}
                >
                  发送定向通知
                </Button>
                <Button
                  variant="outline"
                  className="h-10 w-full border-brand-green text-brand-green hover:bg-brand-green-light"
                  onClick={() => void handleMarketupExport()}
                >
                  导出到 MarketUP
                </Button>
                <button
                  type="button"
                  className="mt-2 w-full text-center text-sm text-brand-red hover:underline"
                  onClick={() => setRemoveOpen(true)}
                >
                  从用户池移除
                </button>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认从用户池移除？</AlertDialogTitle>
            <AlertDialogDescription>
              移除后此用户将不再出现在你的用户池中，历史数据保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={() => void handleRemove()}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
