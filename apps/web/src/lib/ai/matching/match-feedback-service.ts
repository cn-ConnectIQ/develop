import { MatchFeedbackSignal, prisma } from "@connectiq/database";
import { matchPair } from "@/lib/ai/matching/pair-match";
import type { MatchDimensionHit } from "@/lib/ai/matching/types";

export { MatchFeedbackSignal };

/** 各信号对「采纳」的贡献分（离线分析用） */
export const FEEDBACK_SIGNAL_OUTCOME_SCORE: Record<
  MatchFeedbackSignal,
  number
> = {
  [MatchFeedbackSignal.EXCHANGED]: 1,
  [MatchFeedbackSignal.MEETING]: 0.9,
  [MatchFeedbackSignal.VIEWED]: 0.2,
  [MatchFeedbackSignal.IGNORED]: -0.35,
  [MatchFeedbackSignal.DECLINED]: -0.85,
};

const VIEWED_DEDUP_MS = 10 * 60 * 1000;

export type RecordMatchFeedbackInput = {
  viewerId: string;
  targetId: string;
  eventId: string;
  signal: MatchFeedbackSignal;
  matchScore?: number;
  matchDimensions?: MatchDimensionHit[];
};

function serializeDimensions(
  dimensions: MatchDimensionHit[] | undefined,
): MatchDimensionHit[] {
  if (!dimensions?.length) return [];
  return dimensions.filter(
    (d) => d && typeof d.dimension === "string" && typeof d.label === "string",
  );
}

/** 读取反馈时的匹配分与维度快照（优先 MatchBrief 缓存，否则规则 matchPair） */
export async function resolveMatchSnapshot(
  viewerId: string,
  targetId: string,
  eventId: string,
): Promise<{ matchScore: number; matchDimensions: MatchDimensionHit[] }> {
  const brief = await prisma.matchBrief.findUnique({
    where: {
      viewerId_targetId_eventId: { viewerId, targetId, eventId },
    },
    select: { matchScore: true, matchDimensions: true },
  });

  if (brief) {
    return {
      matchScore: brief.matchScore,
      matchDimensions: serializeDimensions(
        brief.matchDimensions as MatchDimensionHit[],
      ),
    };
  }

  const pair = await matchPair(viewerId, targetId, eventId);
  if (pair) {
    return {
      matchScore: pair.score,
      matchDimensions: pair.dimensions,
    };
  }

  return { matchScore: 0, matchDimensions: [] };
}

async function shouldSkipDuplicateViewed(
  viewerId: string,
  targetId: string,
  eventId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - VIEWED_DEDUP_MS);
  const recent = await prisma.matchFeedback.findFirst({
    where: {
      viewerId,
      targetId,
      eventId,
      signal: MatchFeedbackSignal.VIEWED,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(recent);
}

/**
 * 记录推荐反馈（埋点入口）。
 * 交换/见面/查看名片/忽略/婉拒 → 回流用于离线调权。
 */
export async function recordMatchFeedback(
  input: RecordMatchFeedbackInput,
): Promise<{ recorded: boolean; id?: string }> {
  if (input.viewerId === input.targetId) {
    return { recorded: false };
  }

  if (
    input.signal === MatchFeedbackSignal.VIEWED &&
    (await shouldSkipDuplicateViewed(
      input.viewerId,
      input.targetId,
      input.eventId,
    ))
  ) {
    return { recorded: false };
  }

  let matchScore = input.matchScore;
  let matchDimensions = input.matchDimensions;

  if (matchScore === undefined || matchDimensions === undefined) {
    const snapshot = await resolveMatchSnapshot(
      input.viewerId,
      input.targetId,
      input.eventId,
    );
    matchScore = matchScore ?? snapshot.matchScore;
    matchDimensions = matchDimensions ?? snapshot.matchDimensions;
  }

  const row = await prisma.matchFeedback.create({
    data: {
      viewerId: input.viewerId,
      targetId: input.targetId,
      eventId: input.eventId,
      signal: input.signal,
      matchScore: matchScore ?? 0,
      matchDimensions: serializeDimensions(matchDimensions),
    },
    select: { id: true },
  });

  return { recorded: true, id: row.id };
}

/** fire-and-forget 埋点，不阻塞主流程 */
export function trackMatchFeedback(input: RecordMatchFeedbackInput): void {
  void recordMatchFeedback(input).catch(() => {
    // 反馈写入失败不影响交换/见面等主流程
  });
}

export type SubmitMatchFeedbackBody = {
  target_id: string;
  event_id: string;
  signal: "EXCHANGED" | "MEETING" | "VIEWED" | "IGNORED" | "DECLINED";
  match_score?: number;
};

const SIGNAL_MAP: Record<string, MatchFeedbackSignal> = {
  EXCHANGED: MatchFeedbackSignal.EXCHANGED,
  MEETING: MatchFeedbackSignal.MEETING,
  VIEWED: MatchFeedbackSignal.VIEWED,
  IGNORED: MatchFeedbackSignal.IGNORED,
  DECLINED: MatchFeedbackSignal.DECLINED,
};

export async function submitMatchFeedbackFromClient(
  viewerId: string,
  body: SubmitMatchFeedbackBody,
) {
  const signal = SIGNAL_MAP[body.signal];
  if (!signal) {
    throw new Error("无效的 signal");
  }

  return recordMatchFeedback({
    viewerId,
    targetId: body.target_id,
    eventId: body.event_id,
    signal,
    matchScore: body.match_score,
  });
}
