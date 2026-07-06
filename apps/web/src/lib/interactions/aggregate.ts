import {
  LotteryStatus,
  PollStatus,
  PollType,
  prisma,
} from "@connectiq/database";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

export type InteractionFeedType = "ANNOUNCEMENT" | "POLL" | "LOTTERY";

export type InteractionFeedStatus =
  | "PUBLISHED"
  | "ACTIVE"
  | "ENDED"
  | "PENDING_DRAW";

export type InteractionFeedItem = {
  id: string;
  type: InteractionFeedType;
  title: string;
  summary: string;
  isPinned: boolean;
  status: InteractionFeedStatus;
  participantCount: number | null;
  myParticipated: boolean;
  publishedAt: string;
  createdAt: string;
};

export type InteractionFeedQuery = {
  eventId: string;
  userId: string;
  types?: InteractionFeedType[];
  cursor?: string | null;
  limit?: number;
};

export type InteractionFeedResult = {
  items: InteractionFeedItem[];
  nextCursor: string | null;
};

const INTERACTIVE_POLL_TYPES: PollType[] = [
  PollType.SINGLE_CHOICE,
  PollType.MULTI_CHOICE,
  PollType.SURVEY,
  PollType.RATING,
  PollType.WORD_CLOUD,
];

const DISPLAYABLE_POLL_STATUSES: PollStatus[] = [
  PollStatus.LIVE,
  PollStatus.PAUSED,
  PollStatus.CLOSED,
];

const DISPLAYABLE_LOTTERY_STATUSES: LotteryStatus[] = [
  LotteryStatus.OPEN,
  LotteryStatus.ACTIVE,
  LotteryStatus.DRAWING,
  LotteryStatus.ENDED,
  LotteryStatus.FINISHED,
];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const FETCH_BUFFER = 5;

type SortableRow = InteractionFeedItem & { sortAt: Date };

type ParsedCursor = {
  at: Date;
  id: string;
};

function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw)));
}

function truncateSummary(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function parseInteractionTypeFilter(
  raw: string | null,
): InteractionFeedType[] | undefined {
  if (!raw?.trim()) return undefined;
  const upper = raw.trim().toUpperCase();
  if (upper === "ANNOUNCEMENT" || upper === "POLL" || upper === "LOTTERY") {
    return [upper as InteractionFeedType];
  }
  return undefined;
}

export function encodeInteractionCursorFromSort(
  sortAt: Date,
  id: string,
  type: InteractionFeedType,
): string {
  return `${sortAt.toISOString()}|${id}|${type}`;
}

export function encodeInteractionCursor(item: InteractionFeedItem): string {
  return encodeInteractionCursorFromSort(
    new Date(item.publishedAt),
    item.id,
    item.type,
  );
}

export function parseInteractionCursor(raw: string | null): ParsedCursor | null {
  if (!raw?.trim()) return null;
  const [atRaw, id] = raw.split("|");
  if (!atRaw || !id) return null;
  const at = new Date(atRaw);
  if (Number.isNaN(at.getTime())) return null;
  return { at, id };
}

function cursorWhere(cursor: ParsedCursor | null) {
  if (!cursor) return undefined;
  return {
    OR: [
      { publishedAt: { lt: cursor.at } },
      { publishedAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

function pollCursorWhere(cursor: ParsedCursor | null) {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.at } },
      { createdAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

function lotteryCursorWhere(cursor: ParsedCursor | null) {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.at } },
      { createdAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

function mapPollStatus(status: PollStatus): InteractionFeedStatus {
  if (status === PollStatus.CLOSED) return "ENDED";
  return "ACTIVE";
}

function mapLotteryStatus(status: LotteryStatus): InteractionFeedStatus {
  if (status === LotteryStatus.ENDED || status === LotteryStatus.FINISHED) {
    return "ENDED";
  }
  if (status === LotteryStatus.DRAWING) return "PENDING_DRAW";
  return "ACTIVE";
}

function lotteryPrizeSummary(lottery: {
  title: string;
  prizes: unknown;
  prizeItems: Array<{ name: string }>;
}): string {
  if (lottery.prizeItems.length > 0) {
    const names = lottery.prizeItems.slice(0, 3).map((p) => p.name);
    return names.length > 1 ? names.join("、") : names[0]!;
  }
  if (Array.isArray(lottery.prizes) && lottery.prizes.length > 0) {
    const first = lottery.prizes[0] as { name?: string; prize?: string };
    return first.name ?? first.prize ?? lottery.title;
  }
  return lottery.title;
}

function toAnnouncementItem(row: {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  publishedAt: Date;
}): SortableRow {
  const publishedAt = row.publishedAt.toISOString();
  return {
    id: row.id,
    type: "ANNOUNCEMENT",
    title: row.title,
    summary: truncateSummary(row.content),
    isPinned: row.isPinned,
    status: "PUBLISHED",
    participantCount: null,
    myParticipated: false,
    publishedAt,
    createdAt: publishedAt,
    sortAt: row.publishedAt,
  };
}

function toPollItem(poll: {
  id: string;
  title: string;
  status: PollStatus;
  scheduledAt: Date | null;
  createdAt: Date;
  _count: { responses: number };
}): SortableRow {
  const sortAt = poll.createdAt;
  const publishedAt = (poll.scheduledAt ?? poll.createdAt).toISOString();
  return {
    id: poll.id,
    type: "POLL",
    title: poll.title,
    summary: truncateSummary(poll.title),
    isPinned: false,
    status: mapPollStatus(poll.status),
    participantCount: poll._count.responses,
    myParticipated: false,
    publishedAt,
    createdAt: poll.createdAt.toISOString(),
    sortAt,
  };
}

function toLotteryItem(lottery: {
  id: string;
  title: string;
  status: LotteryStatus;
  prizes: unknown;
  drawAt: Date | null;
  createdAt: Date;
  prizeItems: Array<{ name: string }>;
  _count: { entries: number };
}): SortableRow {
  const sortAt = lottery.createdAt;
  const publishedAt = (lottery.drawAt ?? lottery.createdAt).toISOString();
  return {
    id: lottery.id,
    type: "LOTTERY",
    title: lottery.title,
    summary: truncateSummary(lotteryPrizeSummary(lottery)),
    isPinned: false,
    status: mapLotteryStatus(lottery.status),
    participantCount: lottery._count.entries,
    myParticipated: false,
    publishedAt,
    createdAt: lottery.createdAt.toISOString(),
    sortAt,
  };
}

function mergeSortRows(rows: SortableRow[]): SortableRow[] {
  return [...rows].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const diff = b.sortAt.getTime() - a.sortAt.getTime();
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

function stripSortKey(row: SortableRow): InteractionFeedItem {
  const { sortAt: _sortAt, ...item } = row;
  return item;
}

async function fetchAnnouncements(
  eventId: string,
  take: number,
  cursor: ParsedCursor | null,
  pinnedOnly: boolean,
) {
  return prisma.announcement.findMany({
    where: {
      eventId,
      isPinned: pinnedOnly ? true : false,
      ...(pinnedOnly ? {} : cursorWhere(cursor)),
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      publishedAt: true,
    },
  });
}

async function fetchPolls(eventId: string, take: number, cursor: ParsedCursor | null) {
  return prisma.poll.findMany({
    where: {
      eventId,
      type: { in: INTERACTIVE_POLL_TYPES },
      status: { in: DISPLAYABLE_POLL_STATUSES },
      ...pollCursorWhere(cursor),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: { _count: { select: { responses: true } } },
  });
}

async function fetchLotteries(
  eventId: string,
  take: number,
  cursor: ParsedCursor | null,
) {
  return prisma.lottery.findMany({
    where: {
      eventId,
      status: { in: DISPLAYABLE_LOTTERY_STATUSES },
      ...lotteryCursorWhere(cursor),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      prizeItems: { orderBy: { sortOrder: "asc" }, take: 3, select: { name: true } },
      _count: { select: { entries: true } },
    },
  });
}

async function attachParticipation(
  eventId: string,
  userId: string,
  items: InteractionFeedItem[],
): Promise<InteractionFeedItem[]> {
  const pollIds = items.filter((i) => i.type === "POLL").map((i) => i.id);
  const lotteryIds = items.filter((i) => i.type === "LOTTERY").map((i) => i.id);
  if (pollIds.length === 0 && lotteryIds.length === 0) return items;

  const participant = await findParticipantForUser(eventId, userId);
  const [pollResponses, lotteryEntries] = await Promise.all([
    participant && pollIds.length
      ? prisma.pollResponse.findMany({
          where: { pollId: { in: pollIds }, participantId: participant.id },
          select: { pollId: true },
          distinct: ["pollId"],
        })
      : Promise.resolve([]),
    lotteryIds.length
      ? prisma.lotteryEntry.findMany({
          where: { lotteryId: { in: lotteryIds }, userId },
          select: { lotteryId: true },
        })
      : Promise.resolve([]),
  ]);

  const pollSet = new Set(pollResponses.map((row) => row.pollId));
  const lotterySet = new Set(lotteryEntries.map((row) => row.lotteryId));

  return items.map((item) => {
    if (item.type === "POLL") {
      return { ...item, myParticipated: pollSet.has(item.id) };
    }
    if (item.type === "LOTTERY") {
      return { ...item, myParticipated: lotterySet.has(item.id) };
    }
    return item;
  });
}

export async function aggregateEventInteractions(
  query: InteractionFeedQuery,
): Promise<InteractionFeedResult> {
  const limit = clampLimit(query.limit);
  const fetchTake = limit + FETCH_BUFFER;
  const cursor = parseInteractionCursor(query.cursor ?? null);
  const includeAll = !query.types?.length;
  const types = new Set(query.types ?? []);

  const rows: SortableRow[] = [];

  if (!cursor && (includeAll || types.has("ANNOUNCEMENT"))) {
    const pinned = await fetchAnnouncements(query.eventId, fetchTake, null, true);
    rows.push(...pinned.map(toAnnouncementItem));
  }

  const fetches: Promise<void>[] = [];

  if (includeAll || types.has("ANNOUNCEMENT")) {
    fetches.push(
      fetchAnnouncements(query.eventId, fetchTake, cursor, false).then((list) => {
        rows.push(...list.map(toAnnouncementItem));
      }),
    );
  }

  if (includeAll || types.has("POLL")) {
    fetches.push(
      fetchPolls(query.eventId, fetchTake, cursor).then((list) => {
        rows.push(...list.map(toPollItem));
      }),
    );
  }

  if (includeAll || types.has("LOTTERY")) {
    fetches.push(
      fetchLotteries(query.eventId, fetchTake, cursor).then((list) => {
        rows.push(...list.map(toLotteryItem));
      }),
    );
  }

  await Promise.all(fetches);

  const merged = mergeSortRows(rows);
  const page = merged.slice(0, limit);

  const nextCursor =
    merged.length > limit && page.length > 0
      ? encodeInteractionCursorFromSort(
          page[page.length - 1]!.sortAt,
          page[page.length - 1]!.id,
          page[page.length - 1]!.type,
        )
      : null;

  const withParticipation = await attachParticipation(
    query.eventId,
    query.userId,
    page.map(stripSortKey),
  );

  return { items: withParticipation, nextCursor };
}
