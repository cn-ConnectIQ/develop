"use client";

import { resolveInviteMessage } from "@/lib/invite/message";
import { cn } from "@/lib/utils";

type PreviewContext = {
  name: string;
  eventName: string;
  eventDate: string;
  link: string;
  organizer: string;
};

type MessagePreviewProps = {
  channel: "SMS" | "EMAIL" | "WECHAT";
  template: string;
  subject?: string;
  context: PreviewContext;
  className?: string;
};

export function MessagePreview({
  channel,
  template,
  subject,
  context,
  className,
}: MessagePreviewProps) {
  const message = resolveInviteMessage(template, context);

  if (channel === "SMS") {
    return (
      <div className={cn("rounded-xl bg-gray-100 p-4", className)}>
        <div className="mx-auto max-w-[280px] rounded-2xl bg-white p-3 shadow-sm">
          <p className="mb-1 text-[10px] text-text-muted">短信 · 预览</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-ink)]">
            {message}
          </p>
        </div>
      </div>
    );
  }

  if (channel === "WECHAT") {
    return (
      <div className={cn("rounded-xl border border-border-light bg-white p-4", className)}>
        <p className="mb-2 text-xs text-text-muted">微信模板消息 · 预览</p>
        <div className="rounded-lg border border-border-light p-3">
          <p className="text-sm font-medium">{context.eventName}</p>
          <p className="mt-1 text-xs text-text-muted">时间：{context.eventDate}</p>
          <p className="mt-1 text-xs text-text-muted">参会者：{context.name}</p>
          <p className="mt-2 text-xs text-brand-green">点击查看详情 →</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border-light bg-white", className)}>
      <div className="bg-brand-blue px-4 py-3 text-sm font-semibold text-white">
        ConnectIQ
      </div>
      <div className="space-y-3 p-4">
        <p className="text-base font-semibold">
          您已受邀参加 {context.eventName}
        </p>
        <p className="text-xs text-text-muted">
          📅 {context.eventDate} · 📍 活动现场
        </p>
        {subject && (
          <p className="text-xs text-text-muted">主题：{subject}</p>
        )}
        <p className="whitespace-pre-wrap text-sm text-text-muted">{message}</p>
        <div className="pt-2">
          <span className="inline-block rounded-lg bg-brand-blue px-4 py-2 text-sm text-white">
            立即加入 ConnectIQ →
          </span>
        </div>
        <p className="text-[11px] text-text-muted">
          此链接 7 天内有效，仅限 {context.name} 本人使用
        </p>
      </div>
    </div>
  );
}

export const INVITE_VARIABLES = [
  { key: "{name}", label: "姓名" },
  { key: "{event_name}", label: "活动名" },
  { key: "{event_date}", label: "日期" },
  { key: "{link}", label: "激活链接" },
  { key: "{organizer}", label: "主办方" },
] as const;
