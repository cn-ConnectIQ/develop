"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, ScanLine, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminContent } from "@/components/admin/admin-header";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  parseScanContent,
  resolveBadgeQr,
  resolveVisitorUserId,
} from "@/lib/scan-parse";

type ScanMode = "checkin" | "lead_capture";

type VisitorProfile = {
  id: string;
  name: string;
  company?: string;
  title?: string;
  seeks?: string[];
  ai_brief?: string;
};

type LeadPhase = "scan" | "form" | "saved";

type BoothOption = { id: string; code: string; name: string };

async function fetchBooths(eventId: string): Promise<BoothOption[]> {
  const res = await fetch(`/api/events/${eventId}/booths`);
  if (!res.ok) return [];
  const json = await res.json();
  const rows = json.data?.booths ?? json.data ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row: { id: string; code: string; name: string }) => ({
    id: row.id,
    code: row.code,
    name: row.name,
  }));
}

function suggestIntentLevel(visitor: VisitorProfile): {
  level: "A" | "B" | "C";
  reason: string;
} {
  const seeks = visitor.seeks ?? [];
  if (seeks.length >= 2) {
    return { level: "A", reason: visitor.ai_brief ?? "多赛道需求，高意向" };
  }
  if (seeks.length >= 1) {
    return { level: "B", reason: "有明确采购/合作意向" };
  }
  return { level: "C", reason: "待进一步了解需求" };
}

async function fetchVisitor(userId: string): Promise<VisitorProfile> {
  for (const url of [`/api/cards/${userId}`, `/api/users/${userId}/profile`]) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return json.data as VisitorProfile;
    }
  }
  throw new Error("未识别访客名片");
}

async function postCheckin(eventId: string, badgeQr: string) {
  const res = await fetch(`/api/events/${eventId}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ badge_qr: badgeQr }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function postLead(
  eventId: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(`/api/account/events/${eventId}/admin-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? json.message ?? "入库失败");
  }
  return json.data as { id: string; intent_level: string };
}

export function ScanPageClient({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const initialMode: ScanMode =
    searchParams.get("mode") === "lead_capture" ? "lead_capture" : "checkin";
  const initialBoothId =
    searchParams.get("boothId") ?? searchParams.get("booth_id") ?? "";

  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [boothId, setBoothId] = useState(initialBoothId);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [flashOk, setFlashOk] = useState(false);

  const { data: booths = [] } = useQuery({
    queryKey: ["event-booths", eventId],
    queryFn: () => fetchBooths(eventId),
    enabled: mode === "lead_capture",
  });

  useEffect(() => {
    if (initialBoothId) return;
    if (booths.length === 1) {
      setBoothId(booths[0]!.id);
    }
  }, [booths, initialBoothId]);

  const [leadPhase, setLeadPhase] = useState<LeadPhase>("scan");
  const [visitor, setVisitor] = useState<VisitorProfile | null>(null);
  const [name, setName] = useState("");
  const [companyTitle, setCompanyTitle] = useState("");
  const [intentTrack, setIntentTrack] = useState("");
  const [intentLevel, setIntentLevel] = useState<"A" | "B" | "C">("A");
  const [aiReason, setAiReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (leadPhase === "scan") focusInput();
  }, [mode, leadPhase, focusInput]);

  const showSuccessFlash = () => {
    setFlashOk(true);
    setTimeout(() => setFlashOk(false), 700);
  };

  const applyVisitor = (profile: VisitorProfile) => {
    const suggestion = suggestIntentLevel(profile);
    setVisitor(profile);
    setName(profile.name);
    setCompanyTitle(
      [profile.company, profile.title].filter(Boolean).join(" · "),
    );
    setIntentTrack(profile.seeks?.[0] ?? "");
    setIntentLevel(suggestion.level);
    setAiReason(suggestion.reason);
    setNote("");
    setLeadPhase("form");
  };

  const handleCheckin = async (raw: string) => {
    const parsed = parseScanContent(raw);
    const badgeQr = resolveBadgeQr(parsed);
    const result = await postCheckin(eventId, badgeQr);

    if (result.ok) {
      const p = result.json.data?.participant ?? result.json.participant;
      const ticket = p?.ticket_type ?? "普通票";
      showSuccessFlash();
      toast.success(`✓ ${p?.name ?? "参会者"} 签到成功 · ${ticket}`);
      setInput("");
      focusInput();
      return;
    }

    if (result.status === 409) {
      const p = result.json.participant ?? result.json.data?.participant;
      const at = result.json.checked_in_at ?? result.json.data?.checked_in_at;
      const time = at
        ? new Date(at).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      toast.info(`${p?.name ?? "该参会者"} 已在 ${time} 签到`);
      setInput("");
      focusInput();
      return;
    }

    if (result.status === 404) {
      toast.error("未找到此参会者");
      return;
    }

    toast.error(result.json.error ?? "签到失败");
  };

  const handleLeadScan = async (raw: string) => {
    const parsed = parseScanContent(raw);
    const userId = resolveVisitorUserId(parsed);
    if (!userId) {
      toast.error("请扫描参会者名片二维码");
      return;
    }
    const profile = await fetchVisitor(userId);
    applyVisitor(profile);
    setInput("");
  };

  const handleSubmit = async () => {
    if (!visitor || submitting) return;
    if (!boothId) {
      toast.error("请先选择归属展位");
      return;
    }
    setSubmitting(true);
    try {
      const [company, title] = companyTitle.includes("·")
        ? companyTitle.split("·").map((s) => s.trim())
        : [companyTitle, ""];

      await postLead(eventId, {
        visitor_user_id: visitor.id,
        booth_id: boothId,
        name: name.trim() || visitor.name,
        company: company || visitor.company,
        title: title || visitor.title,
        intent_track: intentTrack.trim() || undefined,
        intent_level: intentLevel,
        note: note.trim() || undefined,
        ai_grade_reason: aiReason,
      });

      toast.success("线索已入库");
      setLeadPhase("saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "入库失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onScanInput = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || processing) return;

    setProcessing(true);
    try {
      if (mode === "checkin") {
        await handleCheckin(trimmed);
      } else if (leadPhase === "scan") {
        await handleLeadScan(trimmed);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "处理失败");
    } finally {
      setProcessing(false);
    }
  };

  const resetLeadScan = () => {
    setVisitor(null);
    setLeadPhase("scan");
    focusInput();
  };

  return (
    <AdminContent>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">扫码核验</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AD5 · 对准胸牌或名片二维码，或使用扫码枪输入
          </p>
        </div>
        <Link href={`/events/${eventId}/checkin`}>
          <Button variant="outline">签到看板</Button>
        </Link>
      </div>

      <div className="mb-6 flex gap-2">
        <Button
          variant={mode === "checkin" ? "default" : "outline"}
          onClick={() => {
            setMode("checkin");
            setLeadPhase("scan");
            setVisitor(null);
            setBoothId(initialBoothId);
            setInput("");
            focusInput();
          }}
        >
          <ScanLine className="mr-1.5 size-4" />
          签到核验
        </Button>
        <Button
          variant={mode === "lead_capture" ? "default" : "outline"}
          onClick={() => {
            setMode("lead_capture");
            setLeadPhase("scan");
            setVisitor(null);
            setBoothId(initialBoothId);
            setInput("");
            focusInput();
          }}
        >
          <UserPlus className="mr-1.5 size-4" />
          线索采集
        </Button>
      </div>

      {(mode === "checkin" || leadPhase === "scan") && (
        <div className="rounded-xl border border-border-light bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-muted-foreground">
            {mode === "checkin"
              ? "扫描胸牌二维码完成签到（扫码枪扫描后自动提交）"
              : "扫描访客名片二维码，采集线索入库（非建立连接）"}
          </p>
          <Input
            ref={inputRef}
            value={input}
            placeholder="在此扫描或粘贴二维码内容…"
            className="font-mono text-base"
            disabled={processing}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onScanInput(input);
              }
            }}
          />
          <Button
            className="mt-4"
            disabled={!input.trim() || processing}
            onClick={() => void onScanInput(input)}
          >
            {processing ? "处理中…" : "确认"}
          </Button>
        </div>
      )}

      {mode === "lead_capture" && leadPhase === "form" && visitor && (
        <div className="rounded-xl border border-border-light bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-medium text-brand-blue">
            已识别访客名片 · 信息已预填，确认入库
          </p>

          {booths.length > 0 && (
            <div className="mb-4">
              <Label>归属展位</Label>
              <Select
                value={boothId}
                onValueChange={(value) => value && setBoothId(value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择展位" />
                </SelectTrigger>
                <SelectContent>
                  {booths.map((booth) => (
                    <SelectItem key={booth.id} value={booth.id}>
                      {booth.code} · {booth.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-brand-blue/10 text-lg font-semibold text-brand-blue">
              {name.slice(0, 1)}
            </div>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{companyTitle}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>姓名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>公司 · 职位</Label>
              <Input
                value={companyTitle}
                onChange={(e) => setCompanyTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>意向赛道</Label>
              <Input
                value={intentTrack}
                placeholder="如：视觉质检 / 产线自动化"
                onChange={(e) => setIntentTrack(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                AI 评级 · {intentLevel} 级
              </p>
              <p className="mb-2 text-xs text-muted-foreground">{aiReason}</p>
              <div className="flex gap-2">
                {(["A", "B", "C"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={cn(
                      "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
                      intentLevel === level
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-border-light hover:bg-muted/50",
                    )}
                    onClick={() => setIntentLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                value={note}
                placeholder="补充跟进要点…"
                rows={3}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? "提交中…" : "确认入库"}
            </Button>
            <Button variant="outline" onClick={resetLeadScan}>
              取消
            </Button>
          </div>
        </div>
      )}

      {mode === "lead_capture" && leadPhase === "saved" && (
        <div className="rounded-xl border border-border-light bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="size-8" />
          </div>
          <p className="text-lg font-semibold">线索已入库</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {name} · {intentLevel} 级 · 已同步至线索库
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/events/${eventId}/admin-leads`}>
              <Button variant="outline">查看全场线索</Button>
            </Link>
            <Button onClick={resetLeadScan}>继续扫码采集</Button>
          </div>
        </div>
      )}

      {flashOk && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-emerald-500/20">
          <div className="flex size-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <Check className="size-12" />
          </div>
        </div>
      )}
    </AdminContent>
  );
}
