import { SignalType, prisma } from "@connectiq/database";
import { inferIntentFromSignalPayload } from "@/lib/ai/prompts/complement-check";

/** 行为信号计入实时兴趣的时间窗 */
export const REALTIME_SIGNAL_WINDOW_MS = 45 * 60 * 1000;

/** 判定「正在展位附近」的信号窗口 */
export const REALTIME_PRESENCE_WINDOW_MS = 20 * 60 * 1000;

export type RealtimeTopic = {
  topic: string;
  weight: number;
  trigger: string;
  occurredAt: string;
  signalType: SignalType;
};

const SIGNAL_TYPE_WEIGHT: Partial<Record<SignalType, number>> = {
  [SignalType.POLL_ANSWERED]: 1,
  [SignalType.QNA_ASKED]: 0.95,
  [SignalType.QNA_UPVOTED]: 0.7,
  [SignalType.BOOTH_LEAD_CAPTURED]: 0.9,
  [SignalType.BOOTH_SCAN]: 0.55,
  [SignalType.INTERACTION_JOINED]: 0.6,
  [SignalType.MEETING_BOOKED]: 0.5,
  [SignalType.CONNECTION_MADE]: 0.4,
};

const TRIGGER_LABEL: Partial<Record<SignalType, string>> = {
  [SignalType.POLL_ANSWERED]: "刚投票关注",
  [SignalType.QNA_ASKED]: "刚提问关注",
  [SignalType.QNA_UPVOTED]: "刚互动关注",
  [SignalType.BOOTH_LEAD_CAPTURED]: "刚留资关注",
  [SignalType.BOOTH_SCAN]: "刚扫码关注",
  [SignalType.INTERACTION_JOINED]: "刚参与互动",
  [SignalType.MEETING_BOOKED]: "刚预约洽谈",
  [SignalType.CONNECTION_MADE]: "刚建立连接",
};

function normalizeTopic(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 48);
}

function recencyFactor(occurredAt: Date, now: Date): number {
  const minutesAgo = (now.getTime() - occurredAt.getTime()) / 60_000;
  return Math.exp(-minutesAgo / 30);
}

function triggerLabel(signalType: SignalType): string {
  return TRIGGER_LABEL[signalType] ?? "刚关注";
}

function extractTopicsFromSignal(
  signal: {
    signalType: SignalType;
    inferredIntent: string | null;
    payload: unknown;
    entityId: string | null;
  },
  boothNames: Map<string, string>,
): string[] {
  const topics: string[] = [];

  if (signal.inferredIntent) {
    topics.push(normalizeTopic(signal.inferredIntent));
  }

  const payload =
    signal.payload && typeof signal.payload === "object"
      ? (signal.payload as Record<string, unknown>)
      : {};

  const inferred = inferIntentFromSignalPayload(signal.signalType, payload);
  if (inferred) topics.push(normalizeTopic(inferred));

  if (Array.isArray(payload.selected_options)) {
    for (const opt of payload.selected_options) {
      if (typeof opt === "string" && opt.trim()) {
        topics.push(normalizeTopic(opt));
      }
    }
  }

  if (typeof payload.poll_title === "string" && payload.poll_title.trim()) {
    topics.push(normalizeTopic(payload.poll_title));
  }

  if (typeof payload.question_text === "string" && payload.question_text.trim()) {
    topics.push(normalizeTopic(payload.question_text));
  }

  if (signal.entityId && boothNames.has(signal.entityId)) {
    topics.push(normalizeTopic(boothNames.get(signal.entityId)!));
  }

  return [...new Set(topics.filter(Boolean))];
}

/**
 * 从近期 BoothVisitSignal 提取用户实时兴趣（行为事件流 → 实时兴趣）。
 */
export async function extractRealtimeTopics(
  userId: string,
  eventId: string,
  options?: { windowMs?: number; maxTopics?: number },
): Promise<RealtimeTopic[]> {
  const windowMs = options?.windowMs ?? REALTIME_SIGNAL_WINDOW_MS;
  const maxTopics = options?.maxTopics ?? 5;
  const since = new Date(Date.now() - windowMs);
  const now = new Date();

  const signals = await prisma.boothVisitSignal.findMany({
    where: { userId, eventId, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    take: 40,
    select: {
      signalType: true,
      entityId: true,
      inferredIntent: true,
      payload: true,
      occurredAt: true,
    },
  });

  if (signals.length === 0) return [];

  const boothIds = [
    ...new Set(
      signals
        .map((s) => s.entityId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const booths =
    boothIds.length > 0
      ? await prisma.exhibitorBooth.findMany({
          where: { id: { in: boothIds }, eventId },
          select: { id: true, name: true, code: true },
        })
      : [];

  const boothNames = new Map(
    booths.map((b) => [b.id, `${b.name} (${b.code})`]),
  );

  const topicScores = new Map<
    string,
    { weight: number; trigger: string; occurredAt: Date; signalType: SignalType }
  >();

  for (const signal of signals) {
    const typeWeight = SIGNAL_TYPE_WEIGHT[signal.signalType] ?? 0.35;
    const factor = recencyFactor(signal.occurredAt, now);
    const baseWeight = typeWeight * factor;

    for (const topic of extractTopicsFromSignal(signal, boothNames)) {
      const key = topic.toLowerCase();
      const existing = topicScores.get(key);
      if (!existing || baseWeight > existing.weight) {
        topicScores.set(key, {
          weight: baseWeight,
          trigger: triggerLabel(signal.signalType),
          occurredAt: signal.occurredAt,
          signalType: signal.signalType,
        });
      } else if (existing) {
        existing.weight = Math.min(1, existing.weight + baseWeight * 0.25);
      }
    }
  }

  return [...topicScores.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, maxTopics)
    .map(([topic, meta]) => ({
      topic,
      weight: Math.round(meta.weight * 100) / 100,
      trigger: meta.trigger,
      occurredAt: meta.occurredAt.toISOString(),
      signalType: meta.signalType,
    }));
}

/** 合并静态意向话题作为兜底（权重较低） */
export function mergeStaticIntentTopics(
  realtime: RealtimeTopic[],
  staticTopics: string[],
): RealtimeTopic[] {
  const merged = [...realtime];
  const seen = new Set(realtime.map((t) => t.topic.toLowerCase()));

  for (const raw of staticTopics) {
    const topic = normalizeTopic(raw);
    if (!topic || seen.has(topic.toLowerCase())) continue;
    seen.add(topic.toLowerCase());
    merged.push({
      topic,
      weight: 0.25,
      trigger: "报名意向",
      occurredAt: new Date(0).toISOString(),
      signalType: SignalType.BOOTH_SCAN,
    });
  }

  return merged.sort((a, b) => b.weight - a.weight);
}

export function topicMatchesText(topic: string, text: string): boolean {
  const t = topic.trim().toLowerCase();
  const hay = text.trim().toLowerCase();
  if (!t || !hay) return false;
  if (hay.includes(t) || t.includes(hay)) return true;

  const tTokens = t.split(/[\s、,，/]+/).filter((x) => x.length >= 2);
  return tTokens.some((token) => hay.includes(token));
}
