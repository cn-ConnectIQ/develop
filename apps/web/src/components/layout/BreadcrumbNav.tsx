"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCurrentEvent } from "@/hooks/useCurrentEvent";
import {
  getAccountCenterHref,
  isEventScopedRoute,
} from "@/lib/nav-context";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  overview: "平台概览",
  events: "活动列表",
  participants: "名单管理",
  tickets: "票务配置",
  checkin: "签到看板",
  bigscreen: "大屏",
  interactions: "互动管理",
  reports: "数据报告",
  exhibitors: "展商管理",
  map: "展位地图",
  "form-config": "采集表单",
  "stamp-rally": "集章打卡",
  "booth-ranking": "展位人气榜",
  "booth-route": "AI 展位路线",
  "speed-networking": "Speed Networking",
  "ai-referral": "AI 引荐",
  "high-value-buyer-push": "高价值买家推送",
  manage: "活动管理",
  scan: "扫码核验",
  "admin-leads": "全场线索",
  "exhibitor-reviews": "展商审核",
  "expo-settings": "展会配置",
  "stamp-monitor": "集章监控",
  "data-import": "数据导入",
  "live-ops": "现场指挥中心",
  lottery: "现场抽奖",
  matchmaking: "匹配预热",
  responses: "意图采集结果",
  setup: "会面配置",
  schedule: "会面调度",
  "intent-tags": "意向标签",
  "marketup-sync": "MarketUP 同步",
  settings: "活动设置",
  "org-profile": "信誉展示页",
  "invite-campaigns": "邀请管理",
  users: "用户管理",
  connections: "连接数据分析",
  points: "积分管理",
  moderation: "内容审核",
  integrations: "外部集成",
  marketup: "MarketUP",
  platform: "平台",
  "ai-ops": "AI 运营中心",
  matching: "撮合质量监控",
  generation: "内容生成监控",
  insights: "月度洞察管理",
  feedback: "用户反馈汇总",
  expos: "展会",
  exhibitor: "参展商",
  booths: "展商列表",
  leads: "线索",
  tags: "意向标签",
};

function isOpaqueIdSegment(seg: string) {
  return seg.length > 12 && !SEGMENT_LABELS[seg];
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { currentEvent } = useCurrentEvent();
  const segments = pathname.split("/").filter(Boolean);
  const isAccountAdmin = session?.user?.userType === "ACCOUNT_ADMIN";

  if (segments.length === 0) return null;

  if (pathname === "/events") {
    return (
      <nav
        aria-label="面包屑"
        className="hidden min-w-0 items-center text-xs font-medium text-[var(--admin-ink)] md:flex"
      >
        我的活动
      </nav>
    );
  }

  if (pathname === "/platform/overview") {
    return (
      <nav
        aria-label="面包屑"
        className="hidden min-w-0 items-center text-xs font-medium text-[var(--admin-ink)] md:flex"
      >
        平台概览
      </nav>
    );
  }

  if (isEventScopedRoute(pathname)) {
    const eventName = currentEvent?.name ?? "当前活动";
    const pageSeg = segments[segments.length - 1];
    const pageLabel = isOpaqueIdSegment(pageSeg)
      ? "活动工作台"
      : (SEGMENT_LABELS[pageSeg] ?? pageSeg);

    return (
      <nav
        aria-label="面包屑"
        className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-hidden md:flex"
      >
        {isAccountAdmin && (
          <>
            <Link
              href={getAccountCenterHref()}
              className="shrink-0 text-xs text-text-muted transition-colors hover:text-[var(--admin-ink)]"
            >
              账号中心
            </Link>
            <span className="shrink-0 text-xs text-text-tertiary">/</span>
          </>
        )}
        <span className="truncate text-xs text-text-muted">{eventName}</span>
        <span className="shrink-0 text-xs text-text-tertiary">/</span>
        <span className="truncate text-xs font-medium text-[var(--admin-ink)]">
          {pageLabel}
        </span>
      </nav>
    );
  }

  const crumbs = segments.map((seg, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label = isOpaqueIdSegment(seg)
      ? "当前活动"
      : (SEGMENT_LABELS[seg] ?? seg);
    return { href, label, isLast: index === segments.length - 1 };
  });

  return (
    <nav
      aria-label="面包屑"
      className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-hidden md:flex"
    >
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
          {index > 0 && (
            <span className="shrink-0 text-xs text-text-tertiary">/</span>
          )}
          {crumb.isLast ? (
            <span className="truncate text-xs font-medium text-[var(--admin-ink)]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className={cn(
                "truncate text-xs text-text-muted transition-colors hover:text-[var(--admin-ink)]",
              )}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
