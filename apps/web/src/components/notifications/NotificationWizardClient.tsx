"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TemplateRow = {
  code: string;
  name: string;
  channel: "SMS" | "EMAIL" | "WECHAT";
  category: string;
  audience: string;
  subject: string | null;
  body: string;
  requiresOptOut: boolean;
};

type AudienceType =
  | "all_attendees"
  | "not_activated"
  | "activated_no_intent"
  | "all_exhibitors"
  | "booth"
  | "vip"
  | "custom";

const AUDIENCE_OPTIONS: { type: AudienceType; label: string; hint?: string }[] = [
  { type: "not_activated", label: "未启用玖莅的参会者", hint: "短信主力目标" },
  { type: "activated_no_intent", label: "已启用但未填写意向" },
  { type: "all_attendees", label: "全部参会者", hint: "短信渠道需二次确认" },
  { type: "all_exhibitors", label: "全部展商" },
  { type: "vip", label: "VIP / 嘉宾" },
  { type: "custom", label: "自定义筛选" },
];

const STEPS = [
  "选择分群",
  "选择模板",
  "预览",
  "合规确认",
  "小样测试",
  "发送",
  "效果看板",
] as const;

export function NotificationWizardClient({ eventId }: { eventId: string }) {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [audienceType, setAudienceType] = useState<AudienceType>("not_activated");
  const [confirmAllSms, setConfirmAllSms] = useState(false);
  const [templateCode, setTemplateCode] = useState("");
  const [preview, setPreview] = useState<{
    total: number;
    samples: Array<{ name: string; body: string; fee_hint: string | null; sms?: { charCount: number; segments: number } }>;
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [complianceOk, setComplianceOk] = useState(false);
  const [sampleOk, setSampleOk] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.code === templateCode) ?? null,
    [templates, templateCode],
  );

  const loadTemplates = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/notifications`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "加载模板失败");
      return;
    }
    setTemplates(json.data?.templates ?? []);
  }, [eventId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const audienceFilter = useMemo(
    () => ({
      type: audienceType,
      confirm_all_attendees_sms: confirmAllSms,
      title: customTitle.trim() || undefined,
    }),
    [audienceType, confirmAllSms, customTitle],
  );

  const runPreview = async () => {
    if (!templateCode) {
      toast.error("请先选择模板");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/notifications/preview-audience`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_code: templateCode,
            audience_filter: audienceFilter,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "预览失败");
        return;
      }
      setPreview(json.data);
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const createJob = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_code: templateCode,
          audience_filter: audienceFilter,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "创建任务失败");
        return;
      }
      setJobId(json.data.job.id);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const jobAction = async (action: string) => {
    if (!jobId) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/notifications/jobs/${jobId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "操作失败");
        return;
      }
      if (action === "compliance") {
        setComplianceOk(true);
        toast.success("合规确认已记录");
        setStep(4);
      } else if (action === "sample-test") {
        setSampleOk(true);
        toast.success("小样已发送到您的手机/邮箱");
        setStep(5);
      } else if (action === "send") {
        toast.success(
          `发送完成：成功 ${json.data.sent}，失败 ${json.data.failed}`,
        );
        setStep(6);
        await loadAnalytics();
      }
    } finally {
      setBusy(false);
    }
  };

  const loadAnalytics = async () => {
    if (!jobId) return;
    const res = await fetch(
      `/api/events/${eventId}/notifications/jobs/${jobId}`,
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok) setAnalytics(json.data?.analytics ?? null);
  };

  return (
    <AdminPage>
      <AdminHeader
        title="通知发送"
        description="内置模板 · 短信/邮件 · 合规与频控强制生效"
      />
      <AdminContent>
        <div className="mb-6 flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                i === step
                  ? "border-brand-blue bg-brand-blue text-white"
                  : i < step
                    ? "border-border-light bg-muted/40"
                    : "border-border-light text-text-muted",
              )}
              onClick={() => {
                if (i <= step) setStep(i);
              }}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <SectionCard title="① 选择收件人分群">
            <div className="space-y-3">
              {AUDIENCE_OPTIONS.map((opt) => {
                const smsAllBlocked =
                  selectedTemplate?.channel === "SMS" &&
                  opt.type === "all_attendees" &&
                  !confirmAllSms;
                return (
                  <label
                    key={opt.type}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3",
                      audienceType === opt.type && "border-brand-blue bg-blue-50/40",
                      smsAllBlocked && "opacity-60",
                    )}
                  >
                    <input
                      type="radio"
                      name="audience"
                      className="mt-1"
                      checked={audienceType === opt.type}
                      disabled={
                        selectedTemplate?.channel === "SMS" &&
                        opt.type === "all_attendees" &&
                        !confirmAllSms
                      }
                      onChange={() => {
                        if (
                          selectedTemplate?.channel === "SMS" &&
                          opt.type === "all_attendees" &&
                          !confirmAllSms
                        ) {
                          const ok = window.confirm(
                            "短信群发「全部参会者」成本高、投诉风险大。确认继续？",
                          );
                          if (!ok) return;
                          setConfirmAllSms(true);
                        }
                        setAudienceType(opt.type);
                      }}
                    />
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      {opt.hint ? (
                        <span className="mt-0.5 block text-xs text-text-muted">
                          {opt.hint}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {audienceType === "custom" && (
                <div>
                  <Label>职位关键词</Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="如：采购"
                  />
                </div>
              )}
              {selectedTemplate?.channel === "SMS" &&
                audienceType === "all_attendees" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmAllSms}
                      onChange={(e) => setConfirmAllSms(e.target.checked)}
                    />
                    我已二次确认要对全部参会者发短信
                  </label>
                )}
              <Button type="button" onClick={() => setStep(1)}>
                下一步
              </Button>
            </div>
          </SectionCard>
        )}

        {step === 1 && (
          <SectionCard
            title="② 选择场景模板"
            description="主办方不可自由撰写全文，只能选模板"
          >
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  className={cn(
                    "w-full rounded-md border p-3 text-left",
                    templateCode === t.code && "border-brand-blue bg-blue-50/40",
                  )}
                  onClick={() => setTemplateCode(t.code)}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span>{t.code}</span>
                    <span>{t.name}</span>
                    <span className="rounded bg-muted px-1.5 text-xs">
                      {t.channel}
                    </span>
                    <span className="rounded bg-muted px-1.5 text-xs">
                      {t.category}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                    {t.subject || t.body}
                  </p>
                </button>
              ))}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  上一步
                </Button>
                <Button
                  type="button"
                  disabled={!templateCode || busy}
                  onClick={() => void runPreview()}
                >
                  预览真实数据
                </Button>
              </div>
            </div>
          </SectionCard>
        )}

        {step === 2 && (
          <SectionCard title="③ 变量映射与预览">
            <p className="mb-3 text-sm text-text-muted">
              预计送达人数：{preview?.total ?? 0}（展示随机 3 条真实渲染）
            </p>
            <div className="space-y-3">
              {(preview?.samples ?? []).map((s, idx) => (
                <div key={idx} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 font-medium">{s.name}</div>
                  <pre className="whitespace-pre-wrap text-xs text-text-muted">
                    {s.body}
                  </pre>
                  {s.sms ? (
                    <p className="mt-2 text-xs">
                      字数 {s.sms.charCount} · 预计 {s.sms.segments} 条
                      {s.fee_hint ? ` · ${s.fee_hint}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button type="button" disabled={busy} onClick={() => void createJob()}>
                进入合规确认
              </Button>
            </div>
          </SectionCard>
        )}

        {step === 3 && (
          <SectionCard title="④ 合规与频控校验">
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-text-muted">
              <li>发送时段 08:00–21:00（北京时间）</li>
              <li>短信单人单场 ≤2；邮件 ≤3（会后报告豁免）</li>
              <li>退订名单过滤；激活类自动排除已启用用户</li>
              <li>按 user_id 去重；A 主办方名单不可用于 B</li>
            </ul>
            <label className="mb-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={complianceOk}
                onChange={(e) => setComplianceOk(e.target.checked)}
              />
              <span>
                我确认已就本次触达取得收件人同意，数据来源合法（玖莅为受托处理者）
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                上一步
              </Button>
              <Button
                type="button"
                disabled={!complianceOk || busy}
                onClick={() => void jobAction("compliance")}
              >
                确认并继续
              </Button>
            </div>
          </SectionCard>
        )}

        {step === 4 && (
          <SectionCard
            title="⑤ 小样测试（强制）"
            description="将向操作人自己的手机号/邮箱发送一条真实渲染消息，不可跳过"
          >
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                上一步
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void jobAction("sample-test")}
              >
                发送小样到我
              </Button>
            </div>
            {sampleOk ? (
              <p className="mt-3 text-sm text-green-700">小样已测，可进入发送</p>
            ) : null}
          </SectionCard>
        )}

        {step === 5 && (
          <SectionCard title="⑥ 立即发送">
            <p className="mb-4 text-sm text-text-muted">
              任务 ID：{jobId}
              {!sampleOk || !complianceOk
                ? "（须完成合规与小样）"
                : " · 点击后按分群批量发送"}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(4)}>
                上一步
              </Button>
              <Button
                type="button"
                disabled={!sampleOk || !complianceOk || busy}
                onClick={() => void jobAction("send")}
              >
                立即发送
              </Button>
            </div>
          </SectionCard>
        )}

        {step === 6 && (
          <SectionCard title="⑦ 效果看板（转化率优先）">
            {analytics ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label="转化率（北极星）"
                  value={`${(((analytics.conversion_rate as number) || 0) * 100).toFixed(1)}%`}
                />
                <Metric
                  label="点击率"
                  value={`${(((analytics.click_rate as number) || 0) * 100).toFixed(1)}%`}
                />
                <Metric
                  label="送达率"
                  value={`${(((analytics.delivery_rate as number) || 0) * 100).toFixed(1)}%`}
                />
                <Metric
                  label="退订数"
                  value={String(analytics.optout_count ?? 0)}
                />
                <Metric
                  label="成本估算"
                  value={(() => {
                    const c = analytics.cost as {
                      sms_count: number;
                      email_count: number;
                      unit_price_sms: number;
                      unit_price_email: number;
                    };
                    const total =
                      c.sms_count * c.unit_price_sms +
                      c.email_count * c.unit_price_email;
                    return `¥${total.toFixed(2)}（短信 ${c.sms_count} / 邮件 ${c.email_count}）`;
                  })()}
                />
              </div>
            ) : (
              <p className="text-sm text-text-muted">加载中…</p>
            )}
            <Button
              type="button"
              className="mt-4"
              variant="outline"
              onClick={() => {
                setStep(0);
                setJobId(null);
                setComplianceOk(false);
                setSampleOk(false);
                setAnalytics(null);
                setPreview(null);
              }}
            >
              再发一批
            </Button>
          </SectionCard>
        )}
      </AdminContent>
    </AdminPage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
