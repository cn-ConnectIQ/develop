import { UserRole } from "@connectiq/types";
import type { EventFeatureFlags } from "@/lib/event-feature-flags";
import {
  filterItemsByActivityType,
  resolveEventActivityKind,
} from "@/config/event-menu-config";
import { filterNavByFeatureFlags } from "@/lib/nav-feature-flags";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  Coins,
  FileDown,
  Gift,
  Handshake,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  Map,
  MapPin,
  MessageSquare,
  Monitor,
  Route,
  ScanLine,
  Settings,
  Shield,
  Sparkles,
  Store,
  Tag,
  Trophy,
  Users,
} from "lucide-react";

export type NavSubItem = {
  label: string;
  href: string;
  menuKey?: string;
  external?: boolean;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "default" | "danger";
  isNew?: boolean;
  external?: boolean;
  /** FIX-02 菜单映射 key，用于按 activityType 过滤 */
  menuKey?: string;
  /** 子菜单（如现场抽奖 → 大屏/参与人） */
  children?: NavSubItem[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

function filterNavByActivityType(
  groups: NavGroup[],
  activityType?: string | null,
  eventType?: string | null,
): NavGroup[] {
  const activityKind = resolveEventActivityKind(activityType, eventType);
  return groups
    .map((group) => ({
      ...group,
      items: filterItemsByActivityType(group.items, activityKind),
    }))
    .filter((group) => group.items.length > 0);
}

/** 区域二 — 当前活动上下文导航（A0 子分组） */
export function getEventNavigation(
  role: UserRole,
  eventId: string,
  eventType?: string | null,
  _eventName?: string | null,
  featureFlags?: EventFeatureFlags | null,
  activityType?: string | null,
): NavGroup[] {
  const groups = getEventNavigationGroups(role, eventId, eventType, activityType);
  return filterNavByFeatureFlags(
    filterNavByActivityType(groups, activityType, eventType),
    featureFlags,
  );
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

  if (role === UserRole.ORGANIZER || role === UserRole.EXPO_ORGANIZER) {
    return [
      {
        label: "PLATFORM",
        items: [
          { label: "账号管理中心", href: "/organizer/dashboard", icon: LayoutDashboard },
          { label: "参展企业", href: "/organizer/exhibitors", icon: Store },
          { label: "活动列表", href: "/events", icon: CalendarDays },
          { label: "计费与充值", href: "/organizer/billing", icon: Coins },
          { label: "用户池", href: "/members", icon: Users },
          { label: "信誉展示页", href: "/org-profile", icon: Settings },
        ],
      },
    ];
  }

  return [];
}

function getEventNavigationGroups(
  role: UserRole,
  eventId: string,
  eventType?: string | null,
  activityType?: string | null,
): NavGroup[] {
  switch (role) {
    case UserRole.PLATFORM_ADMIN:
    case UserRole.ORGANIZER:
      return [
          {
            label: "活动设置",
            items: [
              {
                label: "活动工作台",
                href: `/events/${eventId}`,
                icon: LayoutDashboard,
              },
              {
                label: "活动设置",
                href: `/events/${eventId}/settings`,
                icon: Settings,
              },
            ],
          },
          {
            label: "参会者管理",
            items: [
              {
                label: "参与人员管理",
                href: `/events/${eventId}/participants`,
                icon: Users,
              },
              {
                label: "AI 展位路线",
                href: `/events/${eventId}/booth-route`,
                icon: MapPin,
                isNew: true,
              },
              {
                label: "AI 引荐配置",
                href: `/events/${eventId}/ai-referral`,
                icon: Bot,
                isNew: true,
              },
              {
                label: "匹配预热",
                href: `/events/${eventId}/matchmaking`,
                icon: Route,
                isNew: true,
                menuKey: "premeet",
              },
              {
                label: "意图采集结果",
                href: `/events/${eventId}/matchmaking/responses`,
                icon: ClipboardList,
                isNew: true,
                menuKey: "intent-results",
              },
              {
                label: "通知管理",
                href: `/events/${eventId}/notifications`,
                icon: Bell,
                isNew: true,
                menuKey: "notifications",
              },
              {
                label: "会面调度",
                href: `/events/${eventId}/meetings/schedule`,
                icon: LayoutGrid,
                isNew: true,
                menuKey: "meeting-schedule",
              },
            ],
          },
          {
            label: "展商管理",
            items: [
              {
                label: "展会配置",
                href: `/events/${eventId}/expo-settings`,
                icon: Settings,
                isNew: true,
                menuKey: "expo-config",
              },
              {
                label: "展商列表",
                href: `/events/${eventId}/exhibitors/booths`,
                icon: Store,
                menuKey: "exhibitor-list",
              },
              {
                label: "全场线索",
                href: `/events/${eventId}/admin-leads`,
                icon: ClipboardList,
                isNew: true,
                menuKey: "all-leads",
              },
              {
                label: "展位地图",
                href: `/events/${eventId}/exhibitors/map`,
                icon: Map,
                menuKey: "booth-map",
              },
              {
                label: "高价值买家推送",
                href: `/events/${eventId}/high-value-buyer-push`,
                icon: Bell,
                isNew: true,
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
                menuKey: "interaction",
              },
              {
                label: "现场抽奖",
                href: `/events/${eventId}/lottery/big-screen`,
                icon: Gift,
                menuKey: "lottery",
                children: [
                  {
                    label: "大屏抽奖",
                    href: `/events/${eventId}/lottery/big-screen`,
                    menuKey: "lottery-big-screen",
                  },
                  {
                    label: "参与人抽奖",
                    href: `/events/${eventId}/lottery/participant`,
                    menuKey: "lottery-participant",
                  },
                ],
              },
              {
                label: "集章打卡",
                href: `/events/${eventId}/stamp-rally`,
                icon: Trophy,
                isNew: true,
                menuKey: "stamp-rally",
              },
            ],
          },
          {
            label: "Speed Networking",
            items: [
              {
                label: "SN 配置",
                href: `/events/${eventId}/speed-networking`,
                icon: Handshake,
              },
              {
                label: "配对报告",
                href: `/events/${eventId}/reports#matching`,
                icon: BarChart3,
              },
            ],
          },
          {
            label: "现场执行",
            items: [
              {
                label: "扫码核验",
                href: `/events/${eventId}/scan`,
                icon: ScanLine,
                isNew: true,
              },
              {
                label: "签到看板",
                href: `/events/${eventId}/checkin`,
                icon: ScanLine,
              },
              {
                label: "大屏配对",
                href: `/events/${eventId}/screen-pairings`,
                icon: Monitor,
                isNew: true,
              },
            ],
          },
          {
            label: "数据报告",
            items: [
              {
                label: "连接数据分析",
                href: `/events/${eventId}/connections`,
                icon: Handshake,
                isNew: true,
              },
              {
                label: "数据报告",
                href: `/events/${eventId}/reports`,
                icon: BarChart3,
              },
            ],
          },
        ].filter((group) => group.items.length > 0);

    case UserRole.EXPO_ORGANIZER:
      return getEventNavigationGroups(
        UserRole.ORGANIZER,
        eventId,
        eventType ?? "EXPO",
        activityType ?? "EXPO",
      );

    case UserRole.EXHIBITOR: {
      const boothId = eventId;
      return [
        {
          label: "展商工作台",
          items: [
            {
              label: "聚合工作台",
              href: "/exhibitor/dashboard",
              icon: LayoutDashboard,
            },
          ],
        },
        {
          label: "展位概况",
          items: [
            {
              label: "展位实时看板",
              href: `/exhibitor/booths/${boothId}`,
              icon: LayoutDashboard,
            },
            {
              label: "AI 主动找潜客",
              href: `/exhibitor/booths/${boothId}#ai-leads`,
              icon: Sparkles,
              isNew: true,
            },
            {
              label: "展位互动",
              href: `/exhibitor/booths/${boothId}/interactions`,
              icon: MessageSquare,
              isNew: true,
            },
          ],
        },
        {
          label: "线索管理",
          items: [
            {
              label: "来访客户列表",
              href: `/exhibitor/booths/${boothId}/leads`,
              icon: ClipboardList,
            },
            {
              label: "A 级线索",
              href: `/exhibitor/booths/${boothId}/leads?grade=A`,
              icon: Users,
            },
            {
              label: "待跟进",
              href: `/exhibitor/booths/${boothId}/leads?status=followup`,
              icon: MessageSquare,
            },
          ],
        },
        {
          label: "展位设置",
          items: [
            {
              label: "采集表单配置",
              href: `/exhibitor/booths/${boothId}/form-config`,
              icon: ClipboardList,
            },
            {
              label: "展位团队成员",
              href: `/exhibitor/booths/${boothId}/staff`,
              icon: Users,
            },
            {
              label: "目标客户画像配置",
              href: `/exhibitor/booths/${boothId}#target-profile`,
              icon: Settings,
            },
          ],
        },
        {
          label: "数据与集成",
          items: [
            {
              label: "线索导出",
              href: `/exhibitor/booths/${boothId}/leads#export`,
              icon: FileDown,
            },
          ],
        },
        {
          label: "展位报告",
          items: [
            {
              label: "展位 ROI 报告",
              href: `/exhibitor/booths/${boothId}#report`,
              icon: BarChart3,
            },
          ],
        },
      ];
    }

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
      return "账号管理员";
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
