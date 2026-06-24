export type BigscreenDisplayConfig = {
  showResults: boolean;
  lockVotes: boolean;
  featuredResponseId: string | null;
  hiddenResponseIds: string[];
  pinnedResponseIds: string[];
  answeredResponseIds: string[];
  responseMeta?: Record<
    string,
    { hostNote?: string; publicReply?: string; tags?: string[] }
  >;
};

export const DEFAULT_DISPLAY_CONFIG: BigscreenDisplayConfig = {
  showResults: true,
  lockVotes: false,
  featuredResponseId: null,
  hiddenResponseIds: [],
  pinnedResponseIds: [],
  answeredResponseIds: [],
  responseMeta: {},
};

export function displaySettingKey(pollId: string) {
  return `bigscreen_display_${pollId}`;
}

export function parseDisplayConfig(value: unknown): BigscreenDisplayConfig {
  if (!value || typeof value !== "object") return DEFAULT_DISPLAY_CONFIG;
  const v = value as BigscreenDisplayConfig;
  return {
    showResults: v.showResults ?? true,
    lockVotes: v.lockVotes ?? false,
    featuredResponseId: v.featuredResponseId ?? null,
    hiddenResponseIds: Array.isArray(v.hiddenResponseIds) ? v.hiddenResponseIds : [],
    pinnedResponseIds: Array.isArray(v.pinnedResponseIds) ? v.pinnedResponseIds : [],
    answeredResponseIds: Array.isArray(v.answeredResponseIds)
      ? v.answeredResponseIds
      : [],
    responseMeta:
      v.responseMeta && typeof v.responseMeta === "object"
        ? (v.responseMeta as BigscreenDisplayConfig["responseMeta"])
        : {},
  };
}

export type QnaQuestion = {
  id: string;
  text: string;
  likes: number;
  hidden: boolean;
  pinned: boolean;
  answered: boolean;
  featured: boolean;
  onScreen: boolean;
  createdAt: string;
};

export function buildQnaQuestions(
  responses: Array<{
    id: string;
    textAnswer: string | null;
    isOnScreen?: boolean;
    createdAt: Date;
  }>,
  display: BigscreenDisplayConfig,
): QnaQuestion[] {
  const grouped = new Map<
    string,
    { id: string; count: number; createdAt: Date; onScreen: boolean }
  >();
  for (const r of responses) {
    const text = r.textAnswer?.trim();
    if (!text) continue;
    const existing = grouped.get(text);
    if (existing) {
      existing.count += 1;
      if (r.isOnScreen) existing.onScreen = true;
    } else {
      grouped.set(text, {
        id: r.id,
        count: 1,
        createdAt: r.createdAt,
        onScreen: r.isOnScreen ?? false,
      });
    }
  }

  return [...grouped.entries()]
    .map(([text, meta]) => ({
      id: meta.id,
      text,
      likes: meta.count,
      hidden: display.hiddenResponseIds.includes(meta.id),
      pinned: display.pinnedResponseIds.includes(meta.id),
      answered: display.answeredResponseIds.includes(meta.id),
      featured: display.featuredResponseId === meta.id,
      onScreen: meta.onScreen,
      createdAt: meta.createdAt.toISOString(),
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.likes - a.likes;
    });
}

export function pollTypeLabel(type: string): string {
  switch (type) {
    case "WORD_CLOUD":
      return "词云";
    case "QNA":
      return "提问";
    case "ANNOUNCEMENT":
      return "公告";
    case "RATING":
      return "评分";
    default:
      return "投票";
  }
}

export function formatCountdown(closesAt: string | null): string {
  if (!closesAt) return "--:--";
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function countdownProgress(
  closesAt: string | null,
  startedAt: string | null,
): number {
  if (!closesAt) return 1;
  const end = new Date(closesAt).getTime();
  const start = startedAt
    ? new Date(startedAt).getTime()
    : end - 10 * 60 * 1000;
  const now = Date.now();
  const total = Math.max(end - start, 1);
  const remaining = Math.max(0, end - now);
  return remaining / total;
}
