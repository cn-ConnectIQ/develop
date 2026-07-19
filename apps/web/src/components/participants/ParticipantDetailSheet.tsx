"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Briefcase,
  Loader2,
  Mail,
  Phone,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ParticipantActivationDetail } from "@/lib/participant-activation-detail";
import type { ParticipantListItem } from "@/lib/participants";
import { resolveMediaUrl, withPublicPath } from "@/lib/public-path";

type ParticipantDetailSheetProps = {
  eventId: string;
  participant: ParticipantListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function TagList({
  label,
  tags,
  empty,
}: {
  label: string;
  tags: string[];
  empty?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-tertiary">{label}</p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">{empty ?? "暂无"}</p>
      )}
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>参会者名片</SheetTitle>
          <SheetDescription>
            {detail?.activated
              ? "已激活账号的微信名片与本场意图信息"
              : "名单信息；激活后可查看微信二维码与意图"}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="mt-6 space-y-8 pb-6">
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {name}
                </h3>
                {(company || jobTitle) && (
                  <p className="mt-1 text-sm text-text-secondary">
                    {[jobTitle, company].filter(Boolean).join(" · ")}
                  </p>
                )}
                {headline ? (
                  <p className="mt-2 text-sm text-text-tertiary">{headline}</p>
                ) : null}
              </div>

              <div className="space-y-2 text-sm text-text-secondary">
                {phone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 shrink-0 text-text-tertiary" />
                    <span>{phone}</span>
                  </div>
                ) : null}
                {email ? (
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0 text-text-tertiary" />
                    <span className="break-all">{email}</span>
                  </div>
                ) : null}
                {company ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="size-3.5 shrink-0 text-text-tertiary" />
                    <span>{company}</span>
                  </div>
                ) : null}
                {jobTitle ? (
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-3.5 shrink-0 text-text-tertiary" />
                    <span>{jobTitle}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {detail?.activated ? (
                  <Badge variant="success">已激活</Badge>
                ) : (
                  <Badge variant="secondary">未激活</Badge>
                )}
                {detail?.linked_user ? (
                  <Badge variant="info">已关联账号</Badge>
                ) : null}
                {detail?.participant.checked_in_at ? (
                  <Badge variant="success">已签到</Badge>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-medium text-text-primary">
                微信名片
              </h4>
              {!detail?.linked_user ? (
                <p className="text-sm text-text-tertiary">
                  该参会者尚未关联用户账号，暂无微信名片。
                </p>
              ) : wechatQr || wechatId ? (
                <div className="space-y-3">
                  {wechatQr ? (
                    <div className="flex justify-center rounded-xl bg-surface-secondary p-4">
                      <img
                        src={wechatQr}
                        alt="微信二维码"
                        className="size-48 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-secondary px-4 py-10 text-text-tertiary">
                      <QrCode className="size-8 opacity-40" />
                      <p className="text-sm">未上传微信二维码</p>
                    </div>
                  )}
                  {wechatId ? (
                    <p className="text-center text-sm text-text-secondary">
                      微信号：{wechatId}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">
                  已关联账号，但对方尚未完善微信名片。
                </p>
              )}
            </section>

            <section className="space-y-4">
              <h4 className="text-sm font-medium text-text-primary">
                本场意图
              </h4>
              {!detail?.linked_user ? (
                <p className="text-sm text-text-tertiary">
                  激活并填写意图后，将在此展示供需与话题。
                </p>
              ) : hasIntent && intent ? (
                <div className="space-y-4">
                  <TagList label="我能提供" tags={intent.supply_tags} />
                  <TagList label="我在寻找" tags={intent.demand_tags} />
                  <TagList label="关注话题" tags={intent.topics} />
                  {(intent.role || intent.industry || intent.region) && (
                    <div className="space-y-1 text-sm text-text-secondary">
                      {intent.role ? <p>角色：{intent.role}</p> : null}
                      {intent.industry ? <p>行业：{intent.industry}</p> : null}
                      {intent.region ? <p>地区：{intent.region}</p> : null}
                    </div>
                  )}
                  {intent.raw_intent_text ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-text-tertiary">
                        原始意图
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-text-secondary">
                        {intent.raw_intent_text}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">
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
