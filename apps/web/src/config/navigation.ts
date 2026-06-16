import { UserRole } from "@connectiq/types";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  Coins,
  Eye,
  FileDown,
  Handshake,
  LayoutDashboard,
  Link2,
  Map,
  MapPin,
  MessageSquare,
  Monitor,
  ScanLine,
  Send,
  Settings,
  Shield,
  Sparkles,
  Store,
  Tag,
  Ticket,
  Users,
  UserCog,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "default" | "danger";
  isNew?: boolean;
  external?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const EXPO_ONLY_SUFFIXES = ["/exhibitors/map", "/exhibitors/form-config"];

function filterExpoItems(groups: NavGroup[], eventType?: string | null): NavGroup[] {
  if (eventType !== "CONFERENCE") return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !EXPO_ONLY_SUFFIXES.some((suffix) => item.href.includes(suffix)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function shortenEventName(name: string, max = 10) {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

/** 区域一 — 跨活动平台级导航（仅在平台上下文侧栏展示） */
export function getPlatformNavigation(role: UserRole): NavGroup[] {
  if (role === UserRole.PLATFORM_ADMIN) {
    return [
      {
        label: "概览",
        items: [
          { label: "平台概览", href: "/platform/overview", icon: LayoutDashboard },
        ],
      },
      {
        label: "运营中心",
        items: [
          { label: "用户管理", href: "/platform/users", icon: Users },
          { label: "意图标签库", href: "/intent-tags", icon: Tag, isNew: true },
          {
            label: "内容审核",
            href: "/moderation",
            icon: Shield,
            badge: "3",
            badgeVariant: "danger",
          },
        ],
      },
      {
        label: "活动",
        items: [{ label: "我的活动", href: "/events", icon: CalendarDays }],
      },
      {
        label: "全分析",
        items: [
          {
            label: "跨活动对比",
            href: "/platform/connections",
            icon: Link2,
            isNew: true,
          },
          {
            label: "AI 质量监控",
            href: "/platform/ai-ops/matching",
            icon: Sparkles,
            isNew: true,
          },
          { label: "积分管理", href: "/platform/points", icon: Coins },
        ],
      },
      {
        label: "外部集成",
        items: [
          {
            label: "数据源管理",
            href: "/integrations/marketup",
            icon: Sparkles,
          },
        ],
      },
    ];
  }

  if (role === UserRole.ORGANIZER) {
    return [
      {
        label: "PLATFORM",
        items: [
          { label: "活动列表", href: "/events", icon: CalendarDays },
          { label: "用户池", href: "/members", icon: Users },
          { label: "组织主页", href: "/org-profile", icon: Settings },
        ],
      },
    ];
  }

  return [];
}

/** 区域二 — 当前活动上下文导航（A0 子分组） */
export function getEventNavigation(
  role: UserRole,
  eventId: string,
  eventType?: string | null,
  _eventName?: string | null,
): NavGroup[] {
  switch (role) {
    case UserRole.PLATFORM_ADMIN:
    case UserRole.ORGANIZER:
      return filterExpoItems(
        [
          {
            label: "活动设置",
            items: [
              {
                label: "活动工作台",
                href: `/events/${eventId}`,
                icon: LayoutDashboard,
              },
              {
                label: "票务配置",
                href: `/events/${eventId}/tickets`,
                icon: Ticket,
              },
            ],
          },
          {
            label: "参会者管理",
            items: [
              {
                label: "名单管理",
                href: `/events/${eventId}/participants`,
                icon: Users,
              },
              {
                label: "邀请管理",
                href: `/events/${eventId}/invite-campaigns`,
                icon: Send,
              },
            ],
          },
          {
            label: "展商管理",
            items: [
              {
                label: "展位地图",
                href: `/events/${eventId}/exhibitors/map`,
                icon: Map,
              },
              {
                label: "采集表单",
                href: `/events/${eventId}/exhibitors/form-config`,
                icon: Store,
              },
            ],
          },
          {
            label: "互动管理",
            items: [
              {
                label: "互动管理",
                href: `/events/${eventId}/interactions`,
                icon: MessageSquare,
              },
            ],
          },
          {
            label: "Speed Networking",
            items: [
              {
                label: "配对报告",
                href: `/events/${eventId}/reports`,
                icon: Handshake,
              },
            ],
          },
          {
            label: "现场执行",
            items: [
              {
                label: "签到看板",
                href: `/events/${eventId}/checkin`,
                icon: ScanLine,
              },
              {
                label: "签到大屏",
                href: `/events/${eventId}/checkin/bigscreen`,
                icon: Monitor,
                external: true,
              },
              {
                label: "互动大屏",
                href: `/events/${eventId}/bigscreen`,
                icon: Monitor,
                external: true,
              },
            ],
          },
          {
            label: "数据报告",
            items: [
              {
                label: "数据报告",
                href: `/events/${eventId}/reports`,
                icon: BarChart3,
              },
            ],
          },
          {
            label: "外部集成",
            items: [
              {
                label: "MarketUP 集成",
                href: "/integrations/marketup",
                icon: Sparkles,
              },
            ],
          },
        ].filter((group) => group.items.length > 0),
        eventType,
      );

    case UserRole.EXPO_ORGANIZER:
      return [
        {
          label: "活动设置",
          items: [
            {
              label: "基本信息",
              href: `/expos/${eventId}`,
              icon: LayoutDashboard,
            },
            {
              label: "展商报名配置",
              href: `/expos/${eventId}#registration`,
              icon: ClipboardList,
            },
            {
              label: "买家报名配置",
              href: `/expos/${eventId}#buyer`,
              icon: Users,
            },
            {
              label: "工作人员",
              href: `/expos/${eventId}#staff`,
              icon: UserCog,
            },
          ],
        },
        {
          label: "展商管理",
          items: [
            {
              label: "展位地图",
              href: `/events/${eventId}/exhibitors/map`,
              icon: Map,
            },
            {
              label: "展商列表",
              href: `/expos/${eventId}/booths`,
              icon: Store,
            },
            {
              label: "采集表单配置",
              href: `/events/${eventId}/exhibitors/form-config`,
              icon: ClipboardList,
            },
            {
              label: "Hosted Buyer",
              href: `/expos/${eventId}/leads#hosted-buyer`,
              icon: Handshake,
            },
          ],
        },
        {
          label: "买家管理",
          items: [
            {
              label: "买家名单",
              href: `/expos/${eventId}/leads`,
              icon: Users,
            },
            {
              label: "买家签到看板",
              href: `/events/${eventId}/checkin`,
              icon: ScanLine,
            },
            {
              label: "通知发送",
              href: `/expos/${eventId}#notifications`,
              icon: Bell,
            },
          ],
        },
        {
          label: "AI 配置",
          items: [
            {
              label: "买卖撮合配置",
              href: `/expos/${eventId}#matching`,
              icon: Bot,
            },
            {
              label: "撮合预览",
              href: `/expos/${eventId}#matching-preview`,
              icon: Eye,
            },
          ],
        },
        {
          label: "现场执行",
          items: [
            {
              label: "现场仪表盘",
              href: `/events/${eventId}`,
              icon: Monitor,
            },
            {
              label: "场馆地图管理",
              href: `/events/${eventId}/exhibitors/map`,
              icon: MapPin,
            },
            {
              label: "互动大屏",
              href: `/events/${eventId}/bigscreen`,
              icon: Monitor,
              external: true,
            },
          ],
        },
        {
          label: "数据报告",
          items: [
            {
              label: "展商 ROI 报告",
              href: `/events/${eventId}/reports#exhibitor-roi`,
              icon: BarChart3,
            },
            {
              label: "买卖配对报告",
              href: `/events/${eventId}/reports#matching`,
              icon: Handshake,
            },
            {
              label: "签到报告",
              href: `/events/${eventId}/reports#checkin`,
              icon: ScanLine,
            },
          ],
        },
      ].filter((group) => group.items.length > 0);

    case UserRole.EXHIBITOR:
      return [
        {
          label: "展位概况",
          items: [
            {
              label: "展位实时看板",
              href: `/exhibitor/booths/${eventId}`,
              icon: LayoutDashboard,
            },
            {
              label: "AI 主动找潜客",
              href: `/exhibitor/booths/${eventId}#ai-leads`,
              icon: Sparkles,
              isNew: true,
            },
          ],
        },
        {
          label: "线索管理",
          items: [
            {
              label: "来访客户列表",
              href: `/exhibitor/booths/${eventId}/leads`,
              icon: ClipboardList,
            },
            {
              label: "A 级线索",
              href: `/exhibitor/booths/${eventId}/leads?grade=A`,
              icon: Users,
            },
            {
              label: "待跟进",
              href: `/exhibitor/booths/${eventId}/leads?status=followup`,
              icon: MessageSquare,
            },
          ],
        },
        {
          label: "展位设置",
          items: [
            {
              label: "采集表单预览",
              href: `/exhibitor/booths/${eventId}#form-preview`,
              icon: ClipboardList,
            },
            {
              label: "展位团队成员",
              href: `/exhibitor/booths/${eventId}#team`,
              icon: Users,
            },
            {
              label: "目标客户画像配置",
              href: `/exhibitor/booths/${eventId}#target-profile`,
              icon: Settings,
            },
          ],
        },
        {
          label: "数据与集成",
          items: [
            {
              label: "MarketUP 集成",
              href: "/integrations/marketup",
              icon: Sparkles,
            },
            {
              label: "线索导出",
              href: `/exhibitor/booths/${eventId}/leads#export`,
              icon: FileDown,
            },
          ],
        },
        {
          label: "展位报告",
          items: [
            {
              label: "展位 ROI 报告",
              href: `/exhibitor/booths/${eventId}#report`,
              icon: BarChart3,
            },
          ],
        },
      ];

    default:
      return [];
  }
}

/** @deprecated 使用 getPlatformNavigation + getEventNavigation */
export function getNavigation(
  role: UserRole,
  entityId: string | null,
  eventType?: string | null,
  eventName?: string | null,
): NavGroup[] {
  const platform = getPlatformNavigation(role);
  if (!entityId) return platform;

  const eventNav = getEventNavigation(role, entityId, eventType, eventName);
  if (role === UserRole.EXHIBITOR || role === UserRole.EXPO_ORGANIZER) {
    return eventNav;
  }

  return [...platform, ...eventNav];
}

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case UserRole.PLATFORM_ADMIN:
      return "平台管理员";
    case UserRole.ORGANIZER:
      return "活动主办方";
    case UserRole.EXPO_ORGANIZER:
      return "展览主办方";
    case UserRole.EXHIBITOR:
      return "参展商";
    default:
      return "用户";
  }
}

/** 平台管理员 AI 运营中心（附加分组） */
export function getAiOpsNavigation(): NavGroup {
  return {
    label: "AI 运营中心",
    items: [
      { label: "撮合质量监控", href: "/platform/ai-ops/matching", icon: Sparkles },
      { label: "内容生成监控", href: "/platform/ai-ops/generation", icon: MessageSquare },
      { label: "月度洞察管理", href: "/platform/ai-ops/insights", icon: BarChart3 },
      { label: "用户反馈汇总", href: "/platform/ai-ops/feedback", icon: ClipboardList },
    ],
  };
}

/** @deprecated 平台管理员扩展导航已并入 getPlatformNavigation */
export function getPlatformAdminExtras(): NavGroup {
  return { label: "全局分析", items: [] };
}
