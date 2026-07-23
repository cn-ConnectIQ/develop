import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getEventMySummary } from "@/lib/event-my-summary-service";

const DRAFT_SETTING_PREFIX = "post_summary_draft:";

export type ApiPostSummaryDraft = {
  event_id: string;
  event_name: string;
  draft_text: string;
  highlights: string[];
  connection_count: number;
  wechat_count: number;
  generated_at: string;
  stamp_count?: number;
  follow_up_suggestions?: Array<{
    user_id: string;
    name: string;
    match_label?: string;
    draft_text?: string;
  }>;
  share_text?: string;
};

function draftSettingKey(userId: string): string {
  return `${DRAFT_SETTING_PREFIX}${userId}`;
}

function buildDraftText(input: {
  eventName: string;
  connectionCount: number;
  wechatCount: number;
  stampCount: number;
  peerNames: string[];
}): string {
  const { eventName, connectionCount, wechatCount, stampCount, peerNames } =
    input;
  const names = peerNames.slice(0, 3);
  const nameLine =
    names.length > 0
      ? `其中结识了 ${names.join("、")} 等伙伴，期待继续加深合作。`
      : "现场收获不少新灵感，期待后续加深合作。";

  return `刚参加完「${eventName}」，收获满满！

本次建立了 ${connectionCount} 个新连接、互换了 ${wechatCount} 个微信${
    stampCount > 0 ? `，完成了 ${stampCount} 次集章/互动` : ""
  }。
${nameLine}

—— 经由 玖莅 9li.co 记录`;
}

function buildShareText(
  eventName: string,
  connectionCount: number,
  wechatCount: number,
): string {
  return `刚参加完「${eventName}」，建立了 ${connectionCount} 个新连接、换了 ${wechatCount} 个微信。`;
}

function isDraftPayload(value: unknown): value is ApiPostSummaryDraft {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.draft_text === "string" && row.draft_text.trim().length > 0;
}

async function loadCachedDraft(
  eventId: string,
  userId: string,
): Promise<ApiPostSummaryDraft | null> {
  const row = await prisma.eventSetting.findUnique({
    where: {
      eventId_key: { eventId, key: draftSettingKey(userId) },
    },
  });
  if (!row?.value || !isDraftPayload(row.value)) return null;
  return row.value;
}

async function saveDraft(
  eventId: string,
  userId: string,
  draft: ApiPostSummaryDraft,
): Promise<void> {
  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: draftSettingKey(userId) },
    },
    create: {
      eventId,
      key: draftSettingKey(userId),
      value: draft,
    },
    update: {
      value: draft,
    },
  });
}

export async function generatePostSummaryDraft(
  eventId: string,
  userId: string,
): Promise<ApiPostSummaryDraft> {
  const summary = await getEventMySummary(eventId, userId);
  const eventName = summary.event.name;
  const connectionCount = summary.connections;
  const wechatCount = summary.wechatExchanged;
  const stampCount = summary.stampsAndInteractions;
  const peerNames = summary.aiFollowups.map((f) => f.name);

  const draft_text = buildDraftText({
    eventName,
    connectionCount,
    wechatCount,
    stampCount,
    peerNames,
  });
  const share_text = buildShareText(eventName, connectionCount, wechatCount);

  const highlights = [
    `${connectionCount} 个新连接`,
    `${wechatCount} 次微信互换`,
    peerNames[0] ? `与 ${peerNames[0]} 等值得跟进` : "会后可持续跟进",
  ];

  return {
    event_id: eventId,
    event_name: eventName,
    draft_text,
    highlights,
    connection_count: connectionCount,
    wechat_count: wechatCount,
    generated_at: new Date().toISOString(),
    stamp_count: stampCount,
    follow_up_suggestions: summary.aiFollowups.map((f) => ({
      user_id: f.userId,
      name: f.name,
      match_label: f.matchReason,
      draft_text: `Hi ${f.name}，很高兴在「${eventName}」认识你，方便后续聊一下合作机会吗？`,
    })),
    share_text,
  };
}

/** GET：优先读缓存；无缓存则生成并落库 */
export async function getPostSummaryDraft(
  eventId: string,
  userId: string,
): Promise<ApiPostSummaryDraft> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const cached = await loadCachedDraft(eventId, userId);
  if (cached) return cached;

  const draft = await generatePostSummaryDraft(eventId, userId);
  await saveDraft(eventId, userId, draft);
  return draft;
}

/** POST：默认生成（或 regenerate 强制刷新）并落库 */
export async function createOrRefreshPostSummaryDraft(
  eventId: string,
  userId: string,
  options?: { regenerate?: boolean },
): Promise<ApiPostSummaryDraft> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (!options?.regenerate) {
    const cached = await loadCachedDraft(eventId, userId);
    if (cached) return cached;
  }

  const draft = await generatePostSummaryDraft(eventId, userId);
  await saveDraft(eventId, userId, draft);
  return draft;
}
