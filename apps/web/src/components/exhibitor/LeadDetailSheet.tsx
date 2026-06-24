"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CrmSyncStatusBadge,
  formatDateTime,
  LeadStatusBadge,
} from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
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

type LeadDetail = {
  id: string;
  status: string;
  intent_grade: string | null;
  notes: string | null;
  crm_sync_status: string;
  crm_sync_error: string | null;
  crm_synced_at: string | null;
  marketup_contact_id: string | null;
  marketup_lead_id: string | null;
  created_at: string;
  updated_at: string;
  participant: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    job_title: string | null;
  };
  intent_tags: Array<{ id: string; label: string }>;
};

const LEAD_STATUSES = [
  { value: "NEW", label: "新线索" },
  { value: "CONTACTED", label: "已联系" },
  { value: "QUALIFIED", label: "已确认" },
  { value: "LOST", label: "已流失" },
  { value: "WON", label: "已成交" },
] as const;

type LeadDetailSheetProps = {
  boothId: string;
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function LeadDetailSheet({
  boothId,
  leadId,
  open,
  onOpenChange,
  onUpdated,
}: LeadDetailSheetProps) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("NEW");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/booths/${boothId}/leads/${leadId}`);
      if (!res.ok) throw new Error("加载失败");
      const json = await res.json();
      const data = json.data as LeadDetail;
      setDetail(data);
      setStatus(data.status);
      setNotes(data.notes ?? "");
    } catch {
      toast.error("无法加载线索详情");
    } finally {
      setLoading(false);
    }
  }, [boothId, leadId]);

  useEffect(() => {
    if (open && leadId) void loadDetail();
    if (!open) setDetail(null);
  }, [open, leadId, loadDetail]);

  async function handleSave() {
    if (!leadId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/booths/${boothId}/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes || null }),
      });
      if (!res.ok) throw new Error("保存失败");
      toast.success("线索已更新");
      onUpdated();
      void loadDetail();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>线索详情</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-text-muted" />
          </div>
        ) : detail ? (
          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">访客信息</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">姓名</dt>
                  <dd className="font-medium">{detail.participant.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">公司</dt>
                  <dd>{detail.participant.company ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">职位</dt>
                  <dd>{detail.participant.job_title ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">邮箱</dt>
                  <dd className="break-all">{detail.participant.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">手机</dt>
                  <dd>{detail.participant.phone ?? "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">意向标签</h3>
              {detail.intent_tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.intent_tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-md bg-brand-blue-light/30 px-2 py-0.5 text-xs text-brand-blue"
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  {detail.intent_grade ? `${detail.intent_grade} 级` : "—"}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">MarketUP 同步</h3>
              <CrmSyncStatusBadge
                status={detail.crm_sync_status}
                error={detail.crm_sync_error}
              />
              {detail.crm_synced_at && (
                <p className="text-xs text-text-muted">
                  最近同步：{formatDateTime(detail.crm_synced_at)}
                </p>
              )}
              {detail.marketup_lead_id && (
                <p className="text-xs text-text-muted">
                  MarketUP Lead ID：{detail.marketup_lead_id}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="lead-status">跟进状态</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? "NEW")}>
                  <SelectTrigger id="lead-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LeadStatusBadge status={status} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-notes">备注</Label>
                <Textarea
                  id="lead-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="记录跟进情况…"
                />
              </div>
            </section>

            <p className="text-xs text-text-muted">
              创建于 {formatDateTime(detail.created_at)}
            </p>

            <Button
              type="button"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "保存中…" : "保存更新"}
            </Button>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-text-muted">暂无数据</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
