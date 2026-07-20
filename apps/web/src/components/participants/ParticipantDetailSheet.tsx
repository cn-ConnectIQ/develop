"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Phone, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ParticipantActivationDetail } from "@/lib/participant-activation-detail";
import type { ParticipantListItem } from "@/lib/participants";
import { resolveMediaUrl, withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

type ParticipantDetailSheetProps = {
  eventId: string;
  participant: ParticipantListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function initialsOf(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function StatusDot({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px]",
        active ? "text-text-secondary" : "text-text-tertiary",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-brand-green" : "bg-border-strong",
        )}
      />
      {label}
    </span>
  );
}

function IntentRow({
  label,
  tags,
}: {
  label: string;
  tags: string[];
}) {
  if (tags.length === 0) return null;
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 py-3 first:pt-0 last:pb-0">
      <p className="pt-0.5 text-[12px] leading-5 text-text-tertiary">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="border border-border bg-surface px-2.5 py-1 text-[12px] leading-none text-text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ParticipantDetailSheet({
  eventId,
  participant,
  open,
  onOpenChange,
}: ParticipantDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ParticipantActivationDetail | null>(
    null,
  );

  useEffect(() => {
    if (!open || !participant) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetail(null);

    void (async () => {
      try {
        const res = await fetch(
          withPublicPath(
            `/api/events/${eventId}/participants/${participant.id}`,
          ),
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(
            typeof json.error === "string" ? json.error : "加载详情失败",
          );
          return;
        }
        if (!cancelled) {
          setDetail(json.data as ParticipantActivationDetail);
        }
      } catch {
        if (!cancelled) toast.error("加载详情失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, participant, eventId]);

  const name = detail?.participant.name ?? participant?.name ?? "";
  const company =
    detail?.participant.company ??
    detail?.user?.company ??
    participant?.company ??
    null;
  const jobTitle =
    detail?.participant.job_title ?? participant?.jobTitle ?? null;
  const phone =
    detail?.participant.phone ?? detail?.user?.phone ?? participant?.phone;
  const email =
    detail?.participant.email ?? detail?.user?.email ?? participant?.email;
  const wechatQr = resolveMediaUrl(detail?.contact_card?.wechat_qr_url);
  const wechatId = detail?.contact_card?.wechat_id?.trim() || null;
  const headline = detail?.contact_card?.headline?.trim() || null;
  const intent = detail?.intent;

  const hasIntent =
    intent &&
    (intent.supply_tags.length > 0 ||
      intent.demand_tags.length > 0 ||
      intent.topics.length > 0 ||
      Boolean(intent.role) ||
      Boolean(intent.industry) ||
      Boolean(intent.region) ||
      Boolean(intent.raw_intent_text));

  const subtitle = [jobTitle, company].filter(Boolean).join(" · ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto border-l border-border bg-surface p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-[15px] font-semibold tracking-tight text-text-primary">
            参会者名片
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="size-5 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {/* Identity */}
            <section className="border-b border-border px-6 py-6">
              <div className="flex items-start gap-4">
                <div
                  className="flex size-14 shrink-0 items-center justify-center bg-brand-green text-[15px] font-semibold tracking-wide text-white"
                  aria-hidden
                >
                  {initialsOf(name)}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-text-primary">
                    {name || "—"}
                  </h3>
                  {subtitle ? (
                    <p className="mt-1.5 text-[13px] leading-snug text-text-secondary">
                      {subtitle}
                    </p>
                  ) : null}
                  {headline ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-text-tertiary">
                      {headline}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                <StatusDot
                  active={Boolean(detail?.activated)}
                  label={detail?.activated ? "已激活" : "未激活"}
                />
                <StatusDot
                  active={Boolean(detail?.linked_user)}
                  label={detail?.linked_user ? "已关联账号" : "未关联账号"}
                />
                <StatusDot
                  active={Boolean(detail?.participant.checked_in_at)}
                  label={
                    detail?.participant.checked_in_at ? "已签到" : "未签到"
                  }
                />
              </div>

              {(phone || email) && (
                <div className="mt-5 space-y-2 border-t border-border pt-5">
                  {phone ? (
                    <div className="flex items-center gap-3 text-[13px] text-text-secondary">
                      <Phone className="size-3.5 shrink-0 text-text-tertiary" />
                      <span className="tabular-nums">{phone}</span>
                    </div>
                  ) : null}
                  {email ? (
                    <div className="flex items-center gap-3 text-[13px] text-text-secondary">
                      <Mail className="size-3.5 shrink-0 text-text-tertiary" />
                      <span className="break-all">{email}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            {/* WeChat */}
            <section className="border-b border-border px-6 py-6">
              <div className="mb-4 flex items-baseline justify-between">
                <h4 className="text-[13px] font-semibold tracking-tight text-text-primary">
                  微信名片
                </h4>
                {wechatId ? (
                  <span className="font-mono text-[12px] text-text-tertiary">
                    {wechatId}
                  </span>
                ) : null}
              </div>

              {!detail?.linked_user ? (
                <p className="text-[13px] leading-relaxed text-text-tertiary">
                  尚未关联用户账号，暂无微信名片。
                </p>
              ) : wechatQr ? (
                <div className="flex justify-center border border-border bg-[#fafbfa] p-5">
                  <img
                    src={wechatQr}
                    alt="微信二维码"
                    className="size-44 object-contain"
                  />
                </div>
              ) : wechatId ? (
                <div className="flex items-center gap-3 border border-dashed border-border-strong px-4 py-5">
                  <QrCode className="size-5 shrink-0 text-text-tertiary" />
                  <div>
                    <p className="text-[13px] font-medium text-text-secondary">
                      已填写微信号
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-tertiary">
                      对方尚未上传二维码图片
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-text-tertiary">
                  已关联账号，但对方尚未完善微信名片。
                </p>
              )}
            </section>

            {/* Intent */}
            <section className="px-6 py-6">
              <h4 className="mb-4 text-[13px] font-semibold tracking-tight text-text-primary">
                本场意图
              </h4>

              {!detail?.linked_user ? (
                <p className="text-[13px] leading-relaxed text-text-tertiary">
                  激活并填写意图后，将在此展示供需与话题。
                </p>
              ) : hasIntent && intent ? (
                <div className="divide-y divide-border">
                  <IntentRow label="我能提供" tags={intent.supply_tags} />
                  <IntentRow label="我在寻找" tags={intent.demand_tags} />
                  <IntentRow label="关注话题" tags={intent.topics} />
                  {(intent.role || intent.industry || intent.region) && (
                    <div className="grid grid-cols-[72px_1fr] gap-3 py-3 text-[13px]">
                      <p className="text-[12px] text-text-tertiary">补充</p>
                      <div className="space-y-1 text-text-secondary">
                        {intent.role ? <p>角色 · {intent.role}</p> : null}
                        {intent.industry ? (
                          <p>行业 · {intent.industry}</p>
                        ) : null}
                        {intent.region ? <p>地区 · {intent.region}</p> : null}
                      </div>
                    </div>
                  )}
                  {intent.raw_intent_text ? (
                    <div className="grid grid-cols-[72px_1fr] gap-3 py-3">
                      <p className="text-[12px] text-text-tertiary">原文</p>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
                        {intent.raw_intent_text}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-text-tertiary">
                  对方尚未填写本场意图信息。
                </p>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
