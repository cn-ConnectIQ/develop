"use client";

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Mail, MessageCircle, Phone, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { InviteTagPicker } from "@/components/invites/InviteTagPicker";
import { ParticipantTagChips } from "@/components/participants/ParticipantTagChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteChannel } from "@/lib/invite/enums";
import { toastInviteSendError } from "@/lib/invite/invite-credit-toast";
import { FIXED_PARTICIPANT_INVITE_TEMPLATE } from "@/lib/invite/message";
import { parseTagsFromCell } from "@/lib/participant-tags";
import { cn } from "@/lib/utils";

type DirectInvitePanelProps = {
  eventId: string;
  onSent?: () => void;
};

type BatchRow = {
  name: string;
  phone: string;
  email: string;
  tags: string[];
};

const CHANNELS = [
  {
    id: InviteChannel.SMS,
    label: "短信",
    icon: Phone,
    iconClass: "text-brand-blue bg-brand-blue-light",
  },
  {
    id: InviteChannel.EMAIL,
    label: "邮件",
    icon: Mail,
    iconClass: "text-brand-green bg-brand-green-light",
  },
  {
    id: InviteChannel.WECHAT,
    label: "微信",
    icon: MessageCircle,
    iconClass: "text-brand-green bg-brand-green-light",
  },
] as const;

const BATCH_TEMPLATE =
  "姓名,手机号,邮箱,身份标签\n张三,13800138000,zhang@example.com,VIP,Speaker\n李四,13900139000,lisi@example.com,演讲嘉宾,赞助商\n";

function guessColumn(
  headers: string[],
  patterns: RegExp[],
): string | undefined {
  return headers.find((h) =>
    patterns.some((p) => p.test(h.trim().toLowerCase())),
  );
}

function mapBatchRows(
  raw: Record<string, string>[],
  headers: string[],
): BatchRow[] {
  const nameCol = guessColumn(headers, [/姓名|name/i]);
  const phoneCol = guessColumn(headers, [/手机|电话|phone|mobile/i]);
  const emailCol = guessColumn(headers, [/邮箱|邮件|email/i]);
  const tagsCol = guessColumn(headers, [/身份标签|标签|tag/i]);

  if (!nameCol || !phoneCol) return [];

  return raw
    .map((row) => ({
      name: String(row[nameCol] ?? "").trim(),
      phone: String(row[phoneCol] ?? "").trim(),
      email: emailCol ? String(row[emailCol] ?? "").trim() : "",
      tags: tagsCol ? parseTagsFromCell(String(row[tagsCol] ?? "")) : [],
    }))
    .filter((r) => r.name && (r.phone || r.email));
}

export function DirectInvitePanel({ eventId, onSent }: DirectInvitePanelProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [channel, setChannel] = useState<InviteChannel>(InviteChannel.SMS);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [inviteTags, setInviteTags] = useState<string[]>([]);

  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchFileName, setBatchFileName] = useState("");

  const resetSingle = useCallback(() => {
    setName("");
    setPhone("");
    setEmail("");
    setInviteTags([]);
  }, []);

  async function sendInvites(
    contacts: Array<{
      name: string;
      phone?: string;
      email?: string;
      tags?: string[];
    }>,
  ) {
    if (contacts.length === 0) {
      toast.error("请至少添加一位受邀人");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts,
          channel,
          send_now: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? json.message ?? "发送失败";
        const err = new Error(msg) as Error & { redirectTo?: string };
        if (typeof json.redirect_to === "string") {
          err.redirectTo = json.redirect_to;
        } else if (res.status === 402 || String(msg).includes("余额不足")) {
          err.redirectTo = "/organizer/billing";
        }
        throw err;
      }

      const { created, merged, participant_ids } = json.data as {
        created: number;
        merged: number;
        participant_ids: string[];
      };

      toast.success(
        `已发送 ${participant_ids.length} 条邀请（新建 ${created}，合并 ${merged}）`,
      );
      resetSingle();
      setBatchRows([]);
      setBatchFileName("");
      void queryClient.invalidateQueries({ queryKey: ["invite-campaigns", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["invite-records", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      onSent?.();
    } catch (e) {
      toastInviteSendError(e, "发送失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSingleSend() {
    if (!name.trim()) {
      toast.error("请填写姓名");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error("请填写手机号或邮箱");
      return;
    }

    await sendInvites([
      {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        tags: inviteTags,
      },
    ]);
  }

  async function handleBatchSend() {
    await sendInvites(
      batchRows.map((row) => ({
        name: row.name,
        phone: row.phone || undefined,
        email: row.email || undefined,
        tags: row.tags,
      })),
    );
  }

  function parseBatchFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
      });
      if (json.length === 0) {
        toast.error("文件为空");
        return;
      }
      const headers = Object.keys(json[0] ?? {});
      const rows = mapBatchRows(json, headers);
      if (rows.length === 0) {
        toast.error("未识别到有效行，请确保包含「姓名」和「手机号」列");
        return;
      }
      setBatchRows(rows);
      setBatchFileName(file.name);
      toast.success(`已解析 ${rows.length} 条记录`);
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadBatchTemplate() {
    const blob = new Blob(["\uFEFF" + BATCH_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "邀请导入模板.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-light bg-white p-5">
        <Label className="text-xs text-text-muted">发送渠道</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            const active = channel === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                    : "border-border-light text-text-muted hover:bg-gray-50",
                )}
                onClick={() => setChannel(c.id)}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    c.iconClass,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border-light bg-white p-5">
        <Label className="text-xs text-text-muted">
          邀请文案（固定，不可修改）
        </Label>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border-light bg-content/60 p-3 text-sm leading-relaxed text-[var(--admin-ink)]">
          {FIXED_PARTICIPANT_INVITE_TEMPLATE}
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "single" | "batch")}
      >
        <TabsList>
          <TabsTrigger value="single">单个邀请</TabsTrigger>
          <TabsTrigger value="batch">批量导入</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border-light bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="invite-name">姓名 *</Label>
                <Input
                  id="invite-name"
                  className="mt-1.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="张三"
                />
              </div>
              <div>
                <Label htmlFor="invite-phone">手机号</Label>
                <Input
                  id="invite-phone"
                  className="mt-1.5"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="13800138000"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="invite-email">邮箱</Label>
                <Input
                  id="invite-email"
                  className="mt-1.5"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="zhang@example.com"
                />
              </div>
            </div>

            <div className="mt-5 border-t border-border-light pt-5">
              <InviteTagPicker
                value={inviteTags}
                onChange={setInviteTags}
                disabled={submitting}
              />
            </div>

            <Button
              className="mt-5 bg-brand-purple text-white hover:bg-brand-purple/90"
              disabled={submitting}
              onClick={() => void handleSingleSend()}
            >
              <Send className="mr-1.5 size-4" />
              发送邀请
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="batch" className="mt-4 space-y-4">
          <div className="rounded-xl border border-dashed border-border-light bg-white p-8 text-center">
            <Upload className="mx-auto size-8 text-text-muted" />
            <p className="mt-2 text-sm text-text-muted">
              上传 Excel / CSV，需包含姓名、手机号列，可选邮箱与「身份标签」列
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              身份标签列可填：VIP / 演讲嘉宾 / 赞助商 / 媒体 / 投资人，或自定义；
              <br />
              多个标签用英文逗号分隔，如「VIP,Speaker」或「VIP,演讲嘉宾」
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={downloadBatchTemplate}>
                <Download className="mr-1.5 size-4" />
                下载模板
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-muted hover:bg-gray-50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseBatchFile(file);
                    e.target.value = "";
                  }}
                />
                选择文件
              </label>
            </div>
            {batchFileName && (
              <p className="mt-3 text-xs text-brand-blue">{batchFileName}</p>
            )}
          </div>

          {batchRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">姓名</TableHead>
                    <TableHead className="text-xs">手机号</TableHead>
                    <TableHead className="text-xs">邮箱</TableHead>
                    <TableHead className="text-xs">身份标签</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchRows.slice(0, 20).map((row, i) => (
                    <TableRow key={`${row.phone}-${i}`}>
                      <TableCell className="text-sm">{row.name}</TableCell>
                      <TableCell className="text-sm text-text-muted">
                        {row.phone || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-text-muted">
                        {row.email || "—"}
                      </TableCell>
                      <TableCell>
                        {row.tags.length > 0 ? (
                          <ParticipantTagChips tags={row.tags} max={4} />
                        ) : (
                          <span className="text-xs text-text-tertiary">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {batchRows.length > 20 && (
                <p className="border-t border-border-light px-4 py-2 text-xs text-text-muted">
                  预览前 20 条，共 {batchRows.length} 条
                </p>
              )}
              <div className="border-t border-border-light p-4">
                <Button
                  className="bg-brand-purple text-white hover:bg-brand-purple/90"
                  disabled={submitting}
                  onClick={() => void handleBatchSend()}
                >
                  <Send className="mr-1.5 size-4" />
                  批量发送 {batchRows.length} 条邀请
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
