"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Gift,
  Handshake,
  MapPin,
  Megaphone,
  Monitor,
  ScanLine,
  Send,
  Trophy,
} from "lucide-react";
import { AdminContent } from "@/components/admin/admin-header";
import { CheckinFeed } from "@/components/dashboard/CheckinFeed";
import { RealtimeStats } from "@/components/dashboard/RealtimeStats";
import { AiReferralScanCard } from "@/components/events/AiReferralScanCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEventFeatureFlags } from "@/hooks/useEventFeatureFlags";
import { useRealtimeCheckin } from "@/hooks/useRealtimeCheckin";
import type { DashboardAlert } from "@/lib/dashboard-types";
import { isFeatureFlagEnabled } from "@/lib/event-feature-flags";
import { formatElapsed, formatTimeRemaining } from "@/lib/event-utils";
import { LockedOverlay } from "@/components/events/EventReviewBanner";
import { cn } from "@/lib/utils";

async function fetchDashboard(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/dashboard`);
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.data;
}

type DashboardData = {
  event: {
    id: string;
    name: string;
    phase: string;
    reviewStatus?: string;
    startDate: string | null;
    endDate: string | null;
  };
  stats: Parameters<typeof RealtimeStats>[0]["stats"];
  recentCheckIns: Parameters<typeof CheckinFeed>[0]["items"];
  alerts: DashboardAlert[];
};

function QuickActionCard({
  href,
  icon: Icon,
  title,
  subtitle,
  iconClassName,
  borderClassName,
  subtitleClassName,
  external,
  locked,
}: {
  href: string;
  icon: typeof ScanLine;
  title: string;
  subtitle?: string;
  iconClassName?: string;
  borderClassName?: string;
  subtitleClassName?: string;
  external?: boolean;
  locked?: boolean;
}) {
  const className = cn(
    "admin-qtile cursor-pointer bg-white",
    borderClassName,
    locked && "pointer-events-none",
  );

  const content = (
    <>
      <Icon className={cn("size-6 shrink-0", iconClassName ?? "text-brand-blue")} />
      <div className="min-w-0">
        <p className="text-base font-semibold">{title}</p>
        {subtitle && (
          <p className={cn("mt-1 text-xs text-text-muted", subtitleClassName)}>
            {subtitle}
          </p>
        )}
      </div>
    </>
  );

  const tile =
    external && !locked ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    ) : (
      <Link href={locked ? "#" : href} className={className} aria-disabled={locked}>
        {content}
      </Link>
    );

  return (
    <LockedOverlay locked={!!locked} tooltip="审核通过后可用">
      {tile}
    </LockedOverlay>
  );
}

export function EventDashboardClient({ eventId }: { eventId: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: featureFlags } = useEventFeatureFlags(eventId);
  const showAiReferral = isFeatureFlagEnabled(featureFlags, "aiReferral");
  const showSpeedNetworking = isFeatureFlagEnabled(featureFlags, "speedNetworking");
  const showAiBoothRoute = isFeatureFlagEnabled(featureFlags, "aiBoothRoute");
  const showBuyerPush = isFeatureFlagEnabled(featureFlags, "highValueBuyerPush");
  const showLottery = isFeatureFlagEnabled(featureFlags, "lottery");
  const showStampRally = isFeatureFlagEnabled(featureFlags, "stampRally");
  const showBoothRanking = isFeatureFlagEnabled(featureFlags, "boothRanking");
  const showInviteSystem = isFeatureFlagEnabled(featureFlags, "inviteSystem");
  const showFeatureConfig =
    showSpeedNetworking || showAiReferral || showAiBoothRoute || showBuyerPush;
  const showOnsiteTab = showLottery || showStampRally || showBoothRanking;

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["event-dashboard", eventId],
    queryFn: () => fetchDashboard(eventId),
    refetchInterval: 15000,
  });

  useRealtimeCheckin({
    eventId,
    enabled: data?.event.phase === "live",
    onCheckin: () => void refetch(),
  });

  const isLive = data?.event.phase === "live";
  const isReviewLocked = data?.event.reviewStatus === "PENDING_REVIEW";
  const pollSubtitle = data?.stats?.hasLivePoll
    ? data.stats.livePollTitle ?? "互动进行中"
    : "无进行中互动";

  return (
    <AdminContent>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          {showOnsiteTab && (
            <TabsTrigger value="onsite">现场互动</TabsTrigger>
          )}
          {showInviteSystem && (
            <TabsTrigger value="invites">邀请</TabsTrigger>
          )}
          {showAiReferral && (
            <TabsTrigger value="ai-ops">AI 运营</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
      {isLive && data?.event.startDate && (
        <div className="mb-6 rounded-xl bg-brand-green-light p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-brand-green">
              ● {data.event.name} 正在进行中 · 已开始{" "}
              {formatElapsed(new Date(data.event.startDate))}
            </p>
            {data.event.endDate && (
              <p className="text-sm text-brand-amber">
                距活动结束 {formatTimeRemaining(new Date(data.event.endDate))}
              </p>
            )}
          </div>
        </div>
      )}

      <RealtimeStats stats={data?.stats} isLoading={isLoading} />

      {showFeatureConfig && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {showSpeedNetworking && (
            <QuickActionCard
              href={`/events/${eventId}/speed-networking`}
              icon={Handshake}
              title="Speed Networking"
              subtitle="场次与配对配置"
              borderClassName="border-l-4 border-l-brand-purple cursor-pointer"
              iconClassName="text-brand-purple"
            />
          )}
          {showAiReferral && (
            <QuickActionCard
              href={`/events/${eventId}/ai-referral`}
              icon={Bot}
              title="AI 引荐"
              subtitle="扫描与推送配置"
              borderClassName="border-l-4 border-l-brand-purple cursor-pointer"
              iconClassName="text-brand-purple"
            />
          )}
          {showAiBoothRoute && (
            <QuickActionCard
              href={`/events/${eventId}/booth-route`}
              icon={MapPin}
              title="AI 展位路线"
              subtitle="个性化逛展路线"
              borderClassName="cursor-pointer"
            />
          )}
          {showBuyerPush && (
            <QuickActionCard
              href={`/events/${eventId}/high-value-buyer-push`}
              icon={Bell}
              title="高价值买家推送"
              subtitle="A/B 级意向提醒"
              borderClassName="cursor-pointer"
              iconClassName="text-brand-amber"
            />
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          href={`/events/${eventId}/checkin`}
          icon={ScanLine}
          title="扫码签到"
          iconClassName="size-6 text-brand-blue"
          borderClassName="border-l-4 border-l-brand-blue cursor-pointer"
        />
        <QuickActionCard
          href={`/events/${eventId}/interactions`}
          icon={Megaphone}
          title="发布公告"
          borderClassName="cursor-pointer"
          locked={isReviewLocked}
        />
        <QuickActionCard
          href={`/events/${eventId}/interactions`}
          icon={BarChart3}
          title="发起互动"
          subtitle={pollSubtitle}
          borderClassName="cursor-pointer"
          locked={isReviewLocked}
        />
        <QuickActionCard
          href={`/events/${eventId}/bigscreen`}
          icon={Monitor}
          title="大屏控制台"
          subtitle="↗ 新标签页"
          subtitleClassName="text-brand-blue"
          external
          borderClassName="cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border-light bg-white lg:col-span-3">
          <div className="p-5">
            <CheckinFeed
              items={data?.recentCheckIns ?? []}
              isLoading={isLoading}
              onRefresh={() => void refetch()}
              isRefreshing={isFetching}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border-light bg-white lg:col-span-2">
          <div className="border-b border-border-light px-5 py-4">
            <h2 className="text-[15px] font-semibold text-brand-amber">
              需要你的关注
            </h2>
          </div>
          <ul className="px-5">
            {(data?.alerts ?? []).length === 0 && !isLoading && (
              <li className="py-8 text-center text-sm text-text-muted">
                暂无待处理事项
              </li>
            )}
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="border-b border-border-light py-3">
                  <div className="h-5 w-full animate-pulse rounded bg-gray-100" />
                </li>
              ))}
            {data?.alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-start justify-between gap-3 border-b border-border-light py-3 text-sm"
              >
                <span className="flex items-start gap-2 text-text-muted">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-amber" />
                  {alert.message}
                </span>
                <Link
                  href={`/events/${eventId}/${alert.href}`}
                  className="shrink-0 text-brand-blue hover:underline"
                >
                  查看
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

        </TabsContent>

        {showOnsiteTab && (
          <TabsContent value="onsite" className="mt-0 space-y-6">
            <p className="text-sm text-text-muted">
              现场互动模块快捷入口（需在活动设置中开启对应功能）
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard
                href={`/events/${eventId}/interactions`}
                icon={Megaphone}
                title="互动管理"
                subtitle="投票 / 问答 / 公告"
                borderClassName="border-l-4 border-l-brand-blue cursor-pointer"
                locked={isReviewLocked}
              />
              {showLottery && (
                <QuickActionCard
                  href={`/events/${eventId}/lottery`}
                  icon={Gift}
                  title="现场抽奖"
                  subtitle="开奖与奖池管理"
                  borderClassName="border-l-4 border-l-brand-red cursor-pointer"
                  iconClassName="text-brand-red"
                  locked={isReviewLocked}
                />
              )}
              {showStampRally && (
                <QuickActionCard
                  href={`/events/${eventId}/stamp-rally`}
                  icon={Trophy}
                  title="集章打卡"
                  subtitle="展位集章路线"
                  borderClassName="cursor-pointer"
                  iconClassName="text-brand-gold"
                />
              )}
              {showBoothRanking && (
                <QuickActionCard
                  href={`/events/${eventId}/booth-ranking`}
                  icon={BarChart3}
                  title="展位人气榜"
                  subtitle="热度排行大屏"
                  borderClassName="cursor-pointer"
                />
              )}
              <QuickActionCard
                href={`/events/${eventId}/interactions/bigscreen`}
                icon={Monitor}
                title="互动大屏"
                subtitle="↗ 新标签页"
                subtitleClassName="text-brand-blue"
                external
                borderClassName="cursor-pointer"
              />
            </div>
          </TabsContent>
        )}

        {showInviteSystem && (
          <TabsContent value="invites" className="mt-0 space-y-6">
            <div className="rounded-xl border border-border-light bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">邀请体系</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    创建邀请活动、发送通知并追踪激活进度
                  </p>
                </div>
                <Link
                  href={`/events/${eventId}/invite-campaigns`}
                  className="inline-flex h-[34px] items-center rounded-lg bg-brand-blue px-3.5 text-[13px] font-medium text-white hover:bg-brand-blue/90"
                >
                  <Send className="mr-1 size-4" />
                  进入邀请管理
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <QuickActionCard
                  href={`/events/${eventId}/invite-campaigns`}
                  icon={Send}
                  title="邀请活动"
                  subtitle="创建与发送邀请"
                  borderClassName="cursor-pointer"
                />
                <QuickActionCard
                  href={`/events/${eventId}/participants`}
                  icon={ScanLine}
                  title="名单管理"
                  subtitle="查看邀请与激活状态"
                  borderClassName="cursor-pointer"
                />
              </div>
            </div>
          </TabsContent>
        )}

        {showAiReferral && (
          <TabsContent value="ai-ops" className="mt-0 space-y-6">
            <AiReferralScanCard eventId={eventId} />
          </TabsContent>
        )}
      </Tabs>

      <Link
        href={`/events/${eventId}/checkin`}
        className="fixed right-6 bottom-6 flex size-[60px] flex-col items-center justify-center rounded-full bg-brand-blue text-white shadow-lg transition-transform hover:scale-105"
        aria-label="扫码签到"
      >
        <ScanLine className="size-[22px]" />
        <span className="text-[10px]">扫码签到</span>
      </Link>
    </AdminContent>
  );
}
