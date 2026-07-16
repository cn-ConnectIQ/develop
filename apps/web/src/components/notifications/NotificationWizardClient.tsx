"use client";

import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toastInviteSendError } from "@/lib/invite/invite-credit-toast";
import { cn } from "@/lib/utils";

type AudienceType =
  | "all_attendees"
  | "not_activated"
  | "activated_no_intent"
  | "all_exhibitors"
  | "booth"
  | "vip"
  | "custom";

const AUDIENCE_OPTIONS: { type: AudienceType; label: string; hint?: string }[] =
  [
    { type: "not_activated", label: "未启用玖莅的参会者", hint: "短信主力目标" },
    { type: "activated_no_intent", label: "已启用但未填写意向" },
    {
      type: "all_attendees",
      label: "全部参会者",
      hint: "短信渠道需二次确认",
    },
    { type: "all_exhibitors", label: "全部展商" },
    { type: "vip", label: "VIP / 嘉宾" },
    { type: "custom", label: "自定义筛选" },
  ];

const STEPS = [
  "分群与内容",
  "预览",
  "合规确认",
  "小样测试",
  "发送",
  "效果看板",
] as const;

type NotificationWizardClientProps = {
  eventId: string;
  embedded?: boolean;
  onFinished?: () => void;
};

export function NotificationWizardClient({
  eventId,
  embedded = false,
  onFinished,
}: NotificationWizardClientProps) {
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] =
    useState<AudienceType>("not_activated");
  const [confirmAllSms, setConfirmAllSms] = useState(false);
  const [preview, setPreview] = useState<{
    total: number;
    with_user_id?: number;
    samples: Array<{
      name: string;
      body: string;
      fee_hint: string | null;
      sms?: { charCount: number; segments: number };
    }>;
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [complianceOk, setComplianceOk] = useState(false);
  const [sampleOk, setSampleOk] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  const templateCode = channel === "SMS" ? "CUSTOM-SMS" : "CUSTOM-EMAIL";

  const audienceFilter = useMemo(
    () => ({
      type: audienceType,
      confirm_all_attendees_sms: confirmAllSms,
      title: customTitle.trim() || undefined,
    }),
    [audienceType, confirmAllSms, customTitle],
  );

  const variableOverrides = useMemo(() => {
    const payload: Record<string, string> = { 内容: body.trim() };
    if (channel === "EMAIL") {
      payload["主题"] = subject.trim() || "活动通知";
    }
    return payload;
  }, [body, subject, channel]);

  const runPreview = async () => {
    if (!body.trim()) {
      toast.error("请填写通知内容");
      return;
    }
    if (channel === "EMAIL" && !subject.trim()) {
      toast.error("请填写邮件主题");
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
            variable_overrides: variableOverrides,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "预览失败");
        return;
      }
      setPreview(json.data);
      setStep(1);
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
          variable_overrides: variableOverrides,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.error ?? "创建任务失败";
        const err = new Error(msg) as Error & { redirectTo?: string };
        if (res.status === 402 || String(msg).includes("余额不足")) {
          err.redirectTo = "/organizer/billing";
          toastInviteSendError(err);
          return;
        }
        toast.error(msg);
        return;
      }
      setJobId(json.data.job.id);
      setStep(2);
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
        const msg = json.error ?? "操作失败";
        const err = new Error(msg) as Error & { redirectTo?: string };
        if (
          typeof json.redirect_to === "string" ||
          res.status === 402 ||
          String(msg).includes("余额不足")
        ) {
          err.redirectTo = json.redirect_to ?? "/organizer/billing";
          toastInviteSendError(err);
          return;
        }
        toast.error(msg);
        return;
      }
      if (action === "compliance") {
        setComplianceOk(true);
        toast.success("合规确认已记录");
        setStep(3);
      } else if (action === "sample-test") {
        setSampleOk(true);
        toast.success("小样已发送到您的手机/邮箱");
        setStep(4);
      } else if (action === "send") {
        toast.success(
          `发送完成：成功 ${json.data.sent}，失败 ${json.data.failed}`,
        );
        setStep(5);
        await loadAnalytics();
        onFinished?.();
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

  const body_ = (
    <>
      {!embedded && (
        <AdminHeader
          title="发起通知"
          description="自定义短信/邮件 · 合规与频控生效 · 额度按账号扣除"
        />
      )}
      <AdminContent className={embedded ? "!px-0 !pt-0" : undefined}>
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
          <SectionCard title="① 选择分群并编写内容">
            <div className="space-y-5">
              <div>
                <Label className="text-xs text-text-muted">发送渠道</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "SMS" as const, label: "短信" },
                      { id: "EMAIL" as const, label: "邮件" },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        channel === c.id
                          ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                          : "border-border-light text-text-muted",
                      )}
                      onClick={() => setChannel(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {channel === "EMAIL" && (
                <div>
                  <Label htmlFor="notify-subject">邮件主题</Label>
                  <Input
                    id="notify-subject"
                    className="mt-1.5"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="【活动】温馨提醒"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="notify-body">通知正文</Label>
                <Textarea
                  id="notify-body"
                  className="mt-1.5 min-h-[120px]"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    channel === "SMS"
                      ? "活动将于明日开幕，请提前完成入场激活…"
                      : "尊敬的参会者，您好…\n\n活动详情如下…"
                  }
                />
                {channel === "SMS" && (
                  <p className="mt-1 text-xs text-text-muted">
                    系统会自动加「【玖莅】」前缀与「回T退订」后缀
                  </p>
                )}
              </div>

              <div className="space-y-3 border-t border-border-light pt-4">
                <Label className="text-xs text-text-muted">收件人分群</Label>
                {AUDIENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.type}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3",
                      audienceType === opt.type &&
                        "border-brand-blue bg-blue-50/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="audience"
                      className="mt-1"
                      checked={audienceType === opt.type}
                      onChange={() => {
                        if (
                          channel === "SMS" &&
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
                ))}
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
                {channel === "SMS" && audienceType === "all_attendees" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmAllSms}
                      onChange={(e) => setConfirmAllSms(e.target.checked)}
                    />
                    我已二次确认要对全部参会者发短信
                  </label>
                )}
              </div>

              <Button
                type="button"
                disabled={busy}
                onClick={() => void runPreview()}
              >
                下一步：预览
              </Button>
            </div>
          </SectionCard>
        )}

        {step === 1 && (
          <SectionCard title="② 预览">
            <p className="mb-3 text-sm text-text-muted">
              预计受众 {preview?.total ?? 0} 人
              {typeof preview?.with_user_id === "number"
                ? `（其中可投递 ${preview.with_user_id} 人）`
                : ""}
              ，以下为随机 3 条真实渲染
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
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                上一步
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void createJob()}
              >
                进入合规确认
              </Button>
            </div>
          </SectionCard>
        )}

        {step === 2 && (
          <SectionCard title="③ 合规与频控校验">
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-text-muted">
              <li>发送时段 08:00–21:00（北京时间）</li>
              <li>短信单人单场 ≤2；邮件 ≤3</li>
              <li>退订名单过滤；按账号额度扣减</li>
            </ul>
            <label className="mb-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={complianceOk}
                onChange={(e) => setComplianceOk(e.target.checked)}
              />
              <span>
                我确认已就本次触达取得收件人同意，数据来源合法
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
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

        {step === 3 && (
          <SectionCard
            title="④ 小样测试（强制）"
            description="将向操作人自己的手机号/邮箱发送一条真实渲染消息"
          >
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
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

        {step === 4 && (
          <SectionCard title="⑤ 立即发送">
            <p className="mb-4 text-sm text-text-muted">任务 ID：{jobId}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
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

        {step === 5 && (
          <SectionCard title="⑥ 效果看板">
            {analytics ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label="转化率"
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
                    const c = analytics.cost as
                      | {
                          sms_count: number;
                          email_count: number;
                          unit_price_sms: number;
                          unit_price_email: number;
                        }
                      | undefined;
                    if (!c) return "—";
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
                onFinished?.();
              }}
            >
              返回记录 / 再发一批
            </Button>
          </SectionCard>
        )}
      </AdminContent>
    </>
  );

  if (embedded) {
    return <div className="rounded-xl border border-border-light bg-white p-5">{body_}</div>;
  }

  return <AdminPage>{body_}</AdminPage>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
