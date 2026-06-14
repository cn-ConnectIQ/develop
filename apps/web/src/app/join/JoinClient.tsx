"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleAlert, MapPin } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { JoinPageEventInfo, JoinPageResult } from "@/lib/invite/service";
import { formatEventDateRange } from "@/lib/event-utils";
import { cn } from "@/lib/utils";

const OFFICIAL_SITE =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://connectiq.cn";

const FEATURES = [
  {
    emoji: "🤝",
    title: "AI 商务配对",
    description: "AI 基于你的职位和需求，推荐最值得认识的人",
  },
  {
    emoji: "📱",
    title: "扫码即连接",
    description: "现场扫码，30 秒建立有背景的商业连接",
  },
  {
    emoji: "💡",
    title: "会面洞察",
    description: "AI 为每次会面提供背景简报和破冰话术",
  },
] as const;

type JoinClientProps = {
  data: JoinPageResult;
};

export function JoinClient({ data }: JoinClientProps) {
  if (data.kind === "invalid") {
    return (
      <JoinShell>
        <InvalidState />
      </JoinShell>
    );
  }

  if (data.kind === "activated") {
    return (
      <JoinShell>
        <ActivatedState
          eventName={data.event.name}
          deepLink={data.deepLink}
          downloadUrl={data.downloadUrl}
        />
      </JoinShell>
    );
  }

  return (
    <JoinShell
      footer={
        <JoinCtaFooter
          token={data.token}
          tokenExpiresAt={data.tokenExpiresAt}
          downloadUrl={data.downloadUrl}
          deepLink={data.deepLink}
        />
      }
    >
      <EventCard
        event={data.event}
        organizerName={data.organizerName}
        participantName={data.participantName}
      />
      <FeatureList />
    </JoinShell>
  );
}

function JoinShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-[390px] bg-content">
      <JoinHeader />
      <main className={cn("px-0", footer && "pb-52")}>{children}</main>
      {footer}
    </div>
  );
}

function JoinHeader() {
  return (
    <header className="px-4 pt-8 pb-2 text-center">
      <p className="text-2xl font-bold text-brand-blue">ConnectIQ</p>
      <p className="mt-1 text-xs text-text-muted">× 商务社交平台</p>
    </header>
  );
}

function EventCard({
  event,
  organizerName,
  participantName,
}: {
  event: JoinPageEventInfo;
  organizerName: string;
  participantName: string;
}) {
  const dateText = formatEventDateRange(
    event.startDate ? new Date(event.startDate) : null,
    event.endDate ? new Date(event.endDate) : null,
  );

  return (
    <section className="mx-4 mt-6 rounded-2xl bg-white p-5 shadow-sm">
      {event.coverUrl ? (
        <div className="mb-4 aspect-video overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.coverUrl}
            alt={event.name}
            className="size-full object-cover"
          />
        </div>
      ) : (
        <div className="mb-4 aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-brand-blue-light to-brand-blue/20" />
      )}

      <h1 className="text-center text-xl font-bold text-[var(--admin-ink)]">
        {event.name}
      </h1>

      <div className="mt-3 space-y-1.5 text-center text-sm text-text-muted">
        <p className="inline-flex items-center justify-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" />
          {dateText}
        </p>
        {event.location && (
          <p className="inline-flex items-center justify-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            {event.location}
          </p>
        )}
      </div>

      <div className="my-5 border-t border-border-light" />

      <p className="text-center text-sm text-text-muted">
        <span className="font-medium text-[var(--admin-ink)]">
          {organizerName}
        </span>{" "}
        邀请你参加
      </p>
      <p className="mt-1 text-center text-xs text-text-muted">
        专属邀请 · {participantName}
      </p>
    </section>
  );
}

function FeatureList() {
  return (
    <div className="space-y-3 px-4 pt-6 pb-4">
      {FEATURES.map((item) => (
        <article
          key={item.title}
          className="rounded-xl border border-border-light bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-[var(--admin-ink)]">
            {item.emoji} {item.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            {item.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function JoinCtaFooter({
  token,
  tokenExpiresAt,
  downloadUrl,
  deepLink,
}: {
  token: string;
  tokenExpiresAt: string;
  downloadUrl: string;
  deepLink: string;
}) {
  const expiresLabel = format(new Date(tokenExpiresAt), "yyyy年M月d日", {
    locale: zhCN,
  });

  function handleJoin() {
    window.location.href = `/api/invite/activate?token=${encodeURIComponent(token)}&redirect=1`;
  }

  function handleOpenApp() {
    window.location.href = deepLink;
    setTimeout(() => {
      window.location.href = downloadUrl;
    }, 1500);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[390px] border-t border-border-light bg-white px-4 pt-4 pb-8">
      <Button
        type="button"
        className="h-14 w-full rounded-xl bg-brand-blue text-lg font-semibold text-white hover:bg-brand-blue/90"
        onClick={handleJoin}
      >
        立即加入，开始现场社交
      </Button>
      <button
        type="button"
        className="mt-3 w-full text-center text-sm text-brand-blue"
        onClick={handleOpenApp}
      >
        已有账号？直接打开 App
      </button>
      <p className="mt-3 text-center text-xs text-text-muted">
        此邀请链接有效期至 {expiresLabel}，仅限您本人使用
      </p>
    </div>
  );
}

function InvalidState() {
  return (
    <div className="flex flex-col items-center px-6 pt-16 text-center">
      <CircleAlert className="size-16 text-red-600" strokeWidth={1.5} />
      <h1 className="mt-6 text-xl font-bold text-[var(--admin-ink)]">
        链接已过期或无效
      </h1>
      <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-text-muted">
        此邀请链接已失效，请联系活动主办方重新发送邀请
      </p>
      <Link
        href={OFFICIAL_SITE}
        className="mt-8 text-sm font-medium text-brand-blue hover:underline"
      >
        前往官网了解 ConnectIQ
      </Link>
    </div>
  );
}

function ActivatedState({
  eventName,
  deepLink,
  downloadUrl,
}: {
  eventName: string;
  deepLink: string;
  downloadUrl: string;
}) {
  function handleOpenApp() {
    window.location.href = deepLink;
    setTimeout(() => {
      window.location.href = downloadUrl;
    }, 1500);
  }

  return (
    <div className="flex flex-col items-center px-6 pt-16 text-center">
      <CheckCircle2
        className="size-16 text-brand-green"
        strokeWidth={1.5}
      />
      <h1 className="mt-6 text-xl font-bold text-brand-green">
        你已经加入了！
      </h1>
      <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-text-muted">
        打开 ConnectIQ App 查看 {eventName} 的参会者
      </p>
      <Button
        type="button"
        className="mt-8 h-14 w-full max-w-[320px] rounded-xl bg-brand-blue text-lg font-semibold text-white hover:bg-brand-blue/90"
        onClick={handleOpenApp}
      >
        打开 App
      </Button>
    </div>
  );
}
