import { FeedItemType as DbFeedItemType, AiFeedbackType, prisma } from "@connectiq/database";

export type ApiFeedItemType =
  | "AI_REFERRAL"
  | "FOLLOW_UP_REMINDER"
  | "CONTACT_UPDATE"
  | "EVENT_RECOMMEND";

export type ApiFeedActor = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
};

export type ApiFeedItem = {
  id: string;
  type: ApiFeedItemType;
  actor: ApiFeedActor | null;
  payload: Record<string, unknown>;
  ai_score: number | null;
  trigger_reason: string | null;
  is_read: boolean;
  expires_at: string | null;
  created_at: string;
};

function normalizeAiScore(score: number | null): number | null {
  if (score == null) return null;
  if (score <= 5) return score;
  return Math.min(5, Math.max(1, Math.round(score / 20)));
}

function mapDbType(type: DbFeedItemType): ApiFeedItemType {
  switch (type) {
    case DbFeedItemType.MATCH:
    case DbFeedItemType.AI_REFERRAL:
      return "AI_REFERRAL";
    case DbFeedItemType.REMINDER:
      return "FOLLOW_UP_REMINDER";
    case DbFeedItemType.INSIGHT:
      return "CONTACT_UPDATE";
    case DbFeedItemType.SYSTEM:
    default:
      return "EVENT_RECOMMEND";
  }
}

function parsePayload(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // plain text content
  }
  return { content };
}

function buildActorFromProfile(
  userId: string,
  name: string,
  profile?: {
    company: string | null;
  } | null,
): ApiFeedActor {
  return {
    id: userId,
    name,
    company: profile?.company ?? undefined,
  };
}

export function mapFeedItem(row: {
  id: string;
  type: DbFeedItemType;
  content: string;
  aiScore: number | null;
  triggerReason: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
  user?: {
    id: string;
    name: string;
    profile?: {
      company: string | null;
    } | null;
  };
}): ApiFeedItem {
  const payload = parsePayload(row.content);
  const type = mapDbType(row.type);

  let actor: ApiFeedActor | null = null;
  if (row.user) {
    actor = buildActorFromProfile(row.user.id, row.user.name, row.user.profile);
  }

  const expiresAt =
    row.expiresAt?.toISOString() ??
    (typeof payload.expires_at === "string" ? payload.expires_at : null);
  const isRead = payload.is_read === true;

  return {
    id: row.id,
    type,
    actor,
    payload,
    ai_score: normalizeAiScore(row.aiScore),
    trigger_reason: row.triggerReason,
    is_read: isRead,
    expires_at: expiresAt,
    created_at: row.createdAt.toISOString(),
  };
}

export async function listFeedItems(
  userId: string,
  options: { page: number; limit: number; cursor?: string | null },
) {
  const { page, limit, cursor } = options;
  const take = Math.min(Math.max(limit, 1), 50);
  const skip = cursor ? 1 : (Math.max(page, 1) - 1) * take;

  const rows = await prisma.feedItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : { skip }),
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: {
            select: { company: true },
          },
        },
      },
    },
  });

  const hasNext = rows.length > take;
  const pageRows = hasNext ? rows.slice(0, take) : rows;
  const data = pageRows.map(mapFeedItem);
  const nextCursor = hasNext ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    data,
    meta: { hasNext, cursor: nextCursor, page },
  };
}

export async function markFeedItemRead(userId: string, feedId: string) {
  const item = await prisma.feedItem.findFirst({
    where: { id: feedId, userId },
  });
  if (!item) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(item.content) as Record<string, unknown>;
  } catch {
    payload = { content: item.content };
  }
  payload.is_read = true;

  await prisma.feedItem.update({
    where: { id: feedId },
    data: { content: JSON.stringify(payload) },
  });

  return mapFeedItem({ ...item, content: JSON.stringify(payload) });
}

export async function recordFeedFeedback(
  userId: string,
  feedId: string,
  reasons: string[],
  feedType?: string,
) {
  const item = await prisma.feedItem.findFirst({
    where: { id: feedId, userId },
    select: { id: true },
  });
  if (!item) return false;

  await prisma.aiFeedback.create({
    data: {
      userId,
      type: AiFeedbackType.MATCH_USELESS,
      negativeReason: `[feed:${feedId}] ${reasons.join(", ")}${feedType ? ` (${feedType})` : ""}`,
      positive: false,
    },
  });

  return true;
}
