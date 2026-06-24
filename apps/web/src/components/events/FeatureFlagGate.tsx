"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { useEventFeatureFlags } from "@/hooks/useEventFeatureFlags";
import type { EventFeatureFlagKey } from "@/lib/event-feature-flags";

const FLAG_LABELS: Record<EventFeatureFlagKey, string> = {
  speedNetworking: "Speed Networking",
  lottery: "现场抽奖",
  aiBoothRoute: "AI 展位路线",
  aiReferral: "AI 引荐",
  highValueBuyerPush: "高价值买家推送",
  stampRally: "集章打卡",
  boothRanking: "展位热度排行",
  eventSummary: "活动总结报告",
  inviteSystem: "邀请体系",
};

type FeatureFlagGateProps = {
  eventId: string;
  flag: EventFeatureFlagKey;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function FeatureFlagGate({
  eventId,
  flag,
  title,
  description,
  children,
}: FeatureFlagGateProps) {
  const { data: flags, isLoading } = useEventFeatureFlags(eventId);

  if (isLoading) {
    return (
      <AdminPage>
        <AdminContent>
          <p className="py-16 text-center text-sm text-text-muted">加载中…</p>
        </AdminContent>
      </AdminPage>
    );
  }

  if (!flags?.[flag]) {
    return (
      <AdminPage>
        <AdminHeader title={title} description={description} />
        <AdminContent>
          <div className="mx-auto max-w-lg rounded-xl border border-border-light bg-white p-8 text-center">
            <Settings className="mx-auto size-10 text-text-tertiary" />
            <p className="mt-4 font-semibold">
              「{FLAG_LABELS[flag]}」模块未开启
            </p>
            <p className="mt-2 text-sm text-text-muted">
              请在活动设置 → 功能模块中开启后使用。
            </p>
            <Link
              href={`/events/${eventId}/settings`}
              className="mt-6 inline-flex h-9 items-center rounded-lg bg-brand-blue px-4 text-sm text-white"
            >
              前往功能模块设置
            </Link>
          </div>
        </AdminContent>
      </AdminPage>
    );
  }

  return <>{children}</>;
}
