"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";
import type {
  ApiOrgDetailPayload,
  ApiPublicOrgEvent,
} from "@/lib/org-public-service";
import { cn } from "@/lib/utils";

async function fetchOrgPublic(slug: string) {
  const res = await fetch(`/api/org/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "组织不存在");
  }
  return (await res.json()).data as ApiOrgDetailPayload;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  CONFERENCE: "会议",
  EXPO: "展会",
};

const STATUS_LABEL: Record<string, string> = {
  LIVE: "进行中",
  PUBLISHED: "即将举行",
  ENDED: "已结束",
  DRAFT: "筹备中",
};

function formatEventDate(startsAt: string, endsAt: string) {
  if (!startsAt) return "日期待定";
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const startText = format(start, "yyyy年M月d日", { locale: zhCN });
  if (!end) return startText;
  if (start.getMonth() === end.getMonth()) {
    return `${startText} - ${format(end, "d日", { locale: zhCN })}`;
  }
  return `${startText} - ${format(end, "M月d日", { locale: zhCN })}`;
}

function EventCard({ event }: { event: ApiPublicOrgEvent }) {
  const location = [event.city, event.venue].filter(Boolean).join(" · ");

  return (
    <article className="rounded-xl border border-border-light bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-[11px] font-medium text-brand-blue">
              {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
            </span>
            <span className="text-[11px] text-text-muted">
              {STATUS_LABEL[event.status] ?? event.status}
            </span>
            {event.attended && (
              <span className="text-[11px] text-brand-green">已参与</span>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-[var(--admin-ink)]">
            {event.name}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
            <CalendarDays className="size-3.5 shrink-0" />
            {formatEventDate(event.starts_at, event.ends_at)}
          </p>
          {location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
              <MapPin className="size-3.5 shrink-0" />
              {location}
            </p>
          )}
        </div>
      </div>
      {event.participant_count != null && event.participant_count > 0 && (
        <p className="mt-3 text-xs text-text-muted">
          {event.participant_count} 人参与
        </p>
      )}
    </article>
  );
}

export function OrgPublicPageClient({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"about" | "upcoming" | "past">("upcoming");

  const { data, isLoading, error } = useQuery({
    queryKey: ["org-public", slug],
    queryFn: () => fetchOrgPublic(slug),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-content-bg">
        <Loader2 className="size-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-content-bg px-4">
        <Building2 className="size-12 text-text-muted/40" />
        <p className="text-text-muted">
          {error instanceof Error ? error.message : "组织不存在或未公开"}
        </p>
        <Link href="/login" className="text-sm text-brand-blue hover:underline">
          返回登录
        </Link>
      </div>
    );
  }

  const { org, upcomingEvents, pastEvents, myEventCount } = data;

  return (
    <div className="min-h-screen bg-content-bg pb-16">
      <div className="relative h-44 bg-gradient-to-r from-brand-blue/20 to-brand-purple/20 md:h-52">
        {org.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.cover_url}
            alt=""
            className="size-full object-cover"
          />
        ) : null}
      </div>

      <div className="mx-auto max-w-3xl px-4">
        <div className="relative -mt-14 flex flex-col gap-4 sm:-mt-16">
          <div className="flex items-end gap-4">
            <Avatar className="size-24 border-4 border-white bg-white shadow-md sm:size-28">
              {org.logo_url ? (
                <AvatarImage src={org.logo_url} alt={org.name} />
              ) : null}
              <AvatarFallback className="text-2xl font-bold">
                {org.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--admin-ink)]">
                  {org.name}
                </h1>
                {org.is_verified && (
                  <ShieldCheck
                    className="size-5 text-brand-blue"
                    aria-label="已认证"
                  />
                )}
              </div>
              <p className="mt-0.5 text-sm text-text-muted">
                {org.account_type
                  ? (ACCOUNT_TYPE_LABELS[org.account_type] ?? "主办方")
                  : "组织"}
              </p>
            </div>
          </div>
        </div>

        {org.bio ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--admin-ink)]">
            {org.bio}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            <strong className="font-semibold text-[var(--admin-ink)]">
              {org.event_count}
            </strong>
            场活动
          </span>
          {myEventCount > 0 && (
            <span className="text-brand-blue">
              你参与过 {myEventCount} 场活动
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-blue hover:underline"
            >
              <Globe className="size-4" />
              官网
              <ExternalLink className="size-3" />
            </a>
          )}
          {org.contact_email && (
            <a
              href={`mailto:${org.contact_email}`}
              className="inline-flex items-center gap-1 text-text-muted hover:text-brand-blue"
            >
              <Mail className="size-4" />
              {org.contact_email}
            </a>
          )}
        </div>

        <div className="mt-8 border-b border-border-light">
          <nav className="-mb-px flex gap-6">
            {(
              [
                ["about", "关于"],
                ["upcoming", `即将举行 (${upcomingEvents.length})`],
                ["past", `往期活动 (${pastEvents.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "border-b-2 pb-3 text-sm font-medium transition-colors",
                  tab === key
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-text-muted hover:text-[var(--admin-ink)]",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 space-y-4">
          {tab === "about" && (
            <section className="rounded-xl border border-border-light bg-white p-6">
              <h2 className="text-base font-semibold">关于主办方</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {org.bio ?? "该主办方尚未填写简介。"}
              </p>
              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-text-muted">组织类型</dt>
                  <dd className="mt-0.5 font-medium">
                    {(org.account_type &&
                      ACCOUNT_TYPE_LABELS[org.account_type]) ||
                      "组织"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">认证状态</dt>
                  <dd className="mt-0.5 font-medium">
                    {org.is_verified ? "已通过平台认证" : "未认证"}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {tab === "upcoming" && (
            <>
              {upcomingEvents.length === 0 ? (
                <EmptyEvents message="暂无即将举行的活动" />
              ) : (
                upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
            </>
          )}

          {tab === "past" && (
            <>
              {pastEvents.length === 0 ? (
                <EmptyEvents message="暂无往期活动" />
              ) : (
                pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyEvents({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-light bg-white px-6 py-12 text-center text-sm text-text-muted">
      {message}
    </div>
  );
}
