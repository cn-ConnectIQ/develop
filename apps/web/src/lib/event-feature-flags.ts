export const EVENT_FEATURE_FLAG_KEYS = [
  "speedNetworking",
  "lottery",
  "aiBoothRoute",
  "aiReferral",
  "highValueBuyerPush",
  "stampRally",
  "boothRanking",
  "eventSummary",
  "inviteSystem",
] as const;

export type EventFeatureFlagKey = (typeof EVENT_FEATURE_FLAG_KEYS)[number];

export type EventFeatureFlags = Record<EventFeatureFlagKey, boolean>;

export const DEFAULT_EVENT_FEATURE_FLAGS: EventFeatureFlags = {
  speedNetworking: false,
  lottery: true,
  aiBoothRoute: false,
  aiReferral: false,
  highValueBuyerPush: false,
  stampRally: true,
  boothRanking: true,
  eventSummary: true,
  inviteSystem: false,
};

export type EventFeatureFlagGroup = {
  id: string;
  label: string;
  items: Array<{
    key: EventFeatureFlagKey;
    label: string;
    description: string;
  }>;
};

export const EVENT_FEATURE_FLAG_GROUPS: EventFeatureFlagGroup[] = [
  {
    id: "interaction",
    label: "现场互动",
    items: [
      {
        key: "lottery",
        label: "现场抽奖",
        description: "开启后可在活动现场发起抽奖互动，参会者小程序可参与",
      },
    ],
  },
  {
    id: "people",
    label: "人-人连接",
    items: [
      {
        key: "speedNetworking",
        label: "Speed Networking",
        description: "结构化快速配对，帮助参会者在限定轮次内高效认识更多人",
      },
      {
        key: "aiReferral",
        label: "AI 引荐",
        description: "基于意图标签的 AI 推荐与引荐，促成高质量一对一连接",
      },
    ],
  },
  {
    id: "booth",
    label: "人-展位",
    items: [
      {
        key: "stampRally",
        label: "集章打卡",
        description: "参会者扫描展位集章，完成路线后可兑换奖励或参与排行",
      },
      {
        key: "boothRanking",
        label: "展位热度排行",
        description: "在大屏或管理端展示展位访问与互动热度排行",
      },
      {
        key: "aiBoothRoute",
        label: "AI 展位路线",
        description: "为参会者生成个性化逛展路线，优先推荐高匹配展位",
      },
      {
        key: "highValueBuyerPush",
        label: "高价值买家推送",
        description: "向展商推送匹配度高的潜在买家线索（展会场景）",
      },
    ],
  },
  {
    id: "lifecycle",
    label: "会前会后",
    items: [
      {
        key: "inviteSystem",
        label: "邀请体系",
        description: "邀请码/邀请活动，支持会前拉新与参会者裂变",
      },
      {
        key: "eventSummary",
        label: "活动总结报告",
        description: "活动结束后生成连接、互动等数据总结，供主办方复盘",
      },
    ],
  },
];

export function parseEventFeatureFlags(raw: unknown): EventFeatureFlags {
  const flags = { ...DEFAULT_EVENT_FEATURE_FLAGS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return flags;
  }
  for (const key of EVENT_FEATURE_FLAG_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") {
      flags[key] = value;
    }
  }
  return flags;
}

export function mergeEventFeatureFlags(
  current: unknown,
  patch: Partial<EventFeatureFlags>,
): EventFeatureFlags {
  return { ...parseEventFeatureFlags(current), ...patch };
}

export function toApiFeatureFlags(flags: EventFeatureFlags): EventFeatureFlags {
  return { ...flags };
}

export function isFeatureFlagEnabled(
  flags: EventFeatureFlags | null | undefined,
  key: EventFeatureFlagKey,
): boolean {
  return Boolean(flags?.[key]);
}
