import { UserRole } from "@connectiq/types";
import type { EventFeatureFlags } from "@/lib/event-feature-flags";
import { filterNavByFeatureFlags } from "@/lib/nav-feature-flags";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  Eye,
  FileDown,
  FileUp,
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
  Send,
  Settings,
  Shield,
  Sparkles,
  Store,
  Tag,
  Ticket,
  Trophy,
  UserCheck,
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
const MEETING_SETUP_SUFFIX = "/meetings/setup";
const MATCHMAKING_SUFFIX = "/matchmaking";
const MEETINGS_PREFIX = "/meetings/";

function isExpoEvent(
  eventType?: string | null,
  activityType?: string | null,
): boolean {
  return activityType === "EXPO" || eventType === "EXPO";
}

/** 统一账号 EXPO 活动：注入展会专属侧栏入口 */
function injectExpoOrganizerItems(
  groups: NavGroup[],
  eventId: string,
  eventType?: string | null,
  activityType?: string | null,
): NavGroup[] {
  if (!isExpoEvent(eventType, activityType)) return groups;

  return groups.map((group) => {
    if (group.label === "展商管理") {
    const extra: NavItem[] = [
      {
        label: "展会配置",
        href: `/events/${eventId}/expo-settings`,
        icon: Settings,
        isNew: true,
      },
      {
        label: "展商审核",
        href: `/events/${eventId}/exhibitor-reviews`,
        icon: UserCheck,
        isNew: true,
      },
      {
        label: "展商列表",
        href: `/events/${eventId}/exhibitors/booths`,
        icon: Store,
      },
      {
        label: "全场线索",
        href: `/events/${eventId}/admin-leads`,
        icon: ClipboardList,
        isNew: true,
      },
      {
        label: "意向标签",
        href: `/events/${eventId}/intent-tags`,
        icon: Tag,
      },
    ];
    const existingHrefs = new Set(group.items.map((item) => item.href));
    const merged = [
      ...extra.filter((item) => !existingHrefs.has(item.href)),
      ...group.items,
    ];
    return { ...group, items: merged };
    }

    if (group.label === "现场执行") {
      const scanItem: NavItem = {
        label: "扫码核验",
        href: `/events/${eventId}/scan`,
        icon: ScanLine,
        isNew: true,
      };
      if (group.items.some((item) => item.href === scanItem.href)) return group;
      return { ...group, items: [scanItem, ...group.items] };
    }

    if (group.label === "互动管理") {
      const monitorItem: NavItem = {
        label: "集章监控",
        href: `/events/${eventId}/stamp-monitor`,
        icon: Trophy,
        isNew: true,
      };
      if (group.items.some((item) => item.href === monitorItem.href)) return group;
      return { ...group, items: [...group.items, monitorItem] };
    }

    return group;
  });
}

function filterExpoItems(
  groups: NavGroup[],
  eventType?: string | null,
  activityType?: string | null,
): NavGroup[] {
  const isConferenceContext =
    activityType === "CONFERENCE" ||
    (!activityType && eventType === "CONFERENCE");
  if (!isConferenceContext) return groups;
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

/** 参展（EXHIBITION）活动不展示会面桌调度配置 */
function filterExhibitionItems(
  groups: NavGroup[],
  activityType?: string | null,
): NavGroup[] {
  if (activityType !== "EXHIBITION") return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.href.includes(MEETING_SETUP_SUFFIX) &&
          !item.href.includes(MATCHMAKING_SUFFIX) &&
          !item.href.includes(MEETINGS_PREFIX),
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
          { label: "活动列表", href: "/events", icon: CalendarDays },
          { label: "用户池", href: "/members", icon: Users },
          { label: "信誉展示页", href: "/org-profile", icon: Settings },
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
  featureFlags?: EventFeatureFlags | null,
  activityType?: string | null,
): NavGroup[] {
  const groups = getEventNavigationGroups(role, eventId, eventType, activityType);
  return filterNavByFeatureFlags(
    injectExpoOrganizerItems(groups, eventId, eventType, activityType),
    featureFlags,
  );
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
      return filterExhibitionItems(
        filterExpoItems(
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
                label: "活动管理",
                href: `/events/${eventId}/manage`,
                icon: LayoutGrid,
                isNew: true,
              },
              {
                label: "现场指挥中心",
                href: `/events/${eventId}/live-ops`,
                icon: Monitor,
                isNew: true,
              },
              {
                label: "票务配置",
                href: `/events/${eventId}/tickets`,
                icon: Ticket,
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
                label: "名单管理",
                href: `/events/${eventId}/participants`,
                icon: Users,
              },
              {
                label: "数据导入",
                href: `/events/${eventId}/data-import`,
                icon: FileUp,
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
              },
              {
                label: "意图采集结果",
                href: `/events/${eventId}/matchmaking/responses`,
                icon: ClipboardList,
                isNew: true,
              },
              {
                label: "邀请管理",
                href: `/events/${eventId}/invite-campaigns`,
                icon: Send,
              },
              {
                label: "会面配置",
                href: `/events/${eventId}/meetings/setup`,
                icon: CalendarDays,
                isNew: true,
              },
              {
                label: "会面调度",
                href: `/events/${eventId}/meetings/schedule`,
                icon: LayoutGrid,
                isNew: true,
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
            {
              label: "MarketUP 同步",
              href: `/events/${eventId}/marketup-sync`,
              icon: Sparkles,
              isNew: true,
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
              },
              {
                label: "现场抽奖",
                href: `/events/${eventId}/lottery`,
                icon: Gift,
              },
              {
                label: "集章打卡",
                href: `/events/${eventId}/stamp-rally`,
                icon: Trophy,
                isNew: true,
              },
              {
                label: "展位人气榜",
                href: `/events/${eventId}/booth-ranking`,
                icon: BarChart3,
                isNew: true,
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
                label: "签到大屏",
                href: `/events/${eventId}/checkin/bigscreen`,
                icon: Monitor,
                external: true,
              },
              {
                label: "互动大屏",
                href: `/events/${eventId}/interactions/bigscreen`,
                icon: Monitor,
                external: true,
              },
              {
                label: "Poll 投票大屏",
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
        activityType,
      ),
        activityType,
      );

    case UserRole.EXPO_ORGANIZER:
      return filterExhibitionItems(
        filterExpoItems(
          getEventNavigationGroups(
            UserRole.ORGANIZER,
            eventId,
            eventType ?? "EXPO",
            activityType ?? "EXPO",
          ),
          eventType ?? "EXPO",
          activityType ?? "EXPO",
        ),
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
              label: "采集表单预览",
              href: `/exhibitor/booths/${boothId}#form-preview`,
              icon: ClipboardList,
            },
            {
              label: "展位团队成员",
              href: `/exhibitor/booths/${boothId}#team`,
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
              label: "MarketUP 集成",
              href: "/integrations/marketup",
              icon: Sparkles,
            },
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
