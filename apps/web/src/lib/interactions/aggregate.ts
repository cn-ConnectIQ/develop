import {
  LotteryStatus,
  PollStatus,
  PollType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

export type InteractionFeedType =
  | "ANNOUNCEMENT"
  | "POLL"
  | "LOTTERY"
  | "STAMP";

/** 生命周期：ACTIVE 进行中 | SCHEDULED/PUBLISHED 即将开始 | ENDED 已结束 | PENDING_DRAW 待开奖 */
export type InteractionFeedStatus =
  | "ACTIVE"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ENDED"
  | "PENDING_DRAW";

export type InteractionFeedItem = {
  id: string;
  type: InteractionFeedType;
  title: string;
  summary: string;
  subtitle: string;
  isPinned: boolean;
  status: InteractionFeedStatus;
  participantCount: number | null;
  myParticipated: boolean;
  publishedAt: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  boothLabel: string | null;
  resultHint: string | null;
  stampedCount: number | null;
  requiredCount: number | null;
  // snake_case 别名（小程序兼容）
  participant_count: number | null;
  my_participated: boolean;
  published_at: string;
  starts_at: string | null;
  ends_at: string | null;
  is_pinned: boolean;
  booth_label: string | null;
  result_hint: string | null;
  stamped_count: number | null;
  required_count: number | null;
};

export type InteractionFeedQuery = {
  eventId: string;
  userId?: string | null;
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

const DISPLAYABLE_LOTTERY_STATUSES: LotteryStatus[] = [
  LotteryStatus.READY,
  LotteryStatus.OPEN,
  LotteryStatus.ACTIVE,
  LotteryStatus.DRAWING,
  LotteryStatus.ENDED,
  LotteryStatus.FINISHED,
];

const DISPLAYABLE_STAMP_STATUSES: StampRallyStatus[] = [
  StampRallyStatus.ACTIVE,
  StampRallyStatus.ENDED,
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

function withAliases(
  base: Omit<
    InteractionFeedItem,
    | "participant_count"
    | "my_participated"
    | "published_at"
    | "starts_at"
    | "ends_at"
    | "is_pinned"
    | "booth_label"
    | "result_hint"
    | "stamped_count"
    | "required_count"
    | "subtitle"
  > & { subtitle?: string },
): InteractionFeedItem {
  const subtitle = base.subtitle ?? base.summary;
  return {
    ...base,
    subtitle,
    participant_count: base.participantCount,
    my_participated: base.myParticipated,
    published_at: base.publishedAt,
    starts_at: base.startsAt,
    ends_at: base.endsAt,
    is_pinned: base.isPinned,
    booth_label: base.boothLabel,
    result_hint: base.resultHint,
    stamped_count: base.stampedCount,
    required_count: base.requiredCount,
  };
}

export function parseInteractionTypeFilter(
  raw: string | null,
): InteractionFeedType[] | undefined {
  if (!raw?.trim()) return undefined;
  const upper = raw.trim().toUpperCase();
  if (
    upper === "ANNOUNCEMENT" ||
    upper === "POLL" ||
    upper === "LOTTERY" ||
    upper === "STAMP"
  ) {
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

function stampCursorWhere(cursor: ParsedCursor | null) {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.at } },
      { createdAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

function mapPollFeedStatus(
  status: PollStatus,
  scheduledAt: Date | null,
): InteractionFeedStatus {
  if (status === PollStatus.CLOSED) return "ENDED";
  if (status === PollStatus.LIVE || status === PollStatus.PAUSED) return "ACTIVE";
  // DRAFT + 已排期 → 即将开始
  if (scheduledAt && scheduledAt.getTime() > Date.now()) return "SCHEDULED";
  if (status === PollStatus.DRAFT) return "SCHEDULED";
  return "ACTIVE";
}

function mapLotteryFeedStatus(
  status: LotteryStatus,
  drawAt: Date | null,
): InteractionFeedStatus {
  if (status === LotteryStatus.ENDED || status === LotteryStatus.FINISHED) {
    return "ENDED";
  }
  if (status === LotteryStatus.DRAWING) return "PENDING_DRAW";
  if (status === LotteryStatus.READY) return "SCHEDULED";
  if (
    (status === LotteryStatus.OPEN || status === LotteryStatus.ACTIVE) &&
    drawAt &&
    drawAt.getTime() > Date.now() + 60_000
  ) {
    // 已开放但开奖时间明显在未来 → 即将开始
    return "SCHEDULED";
  }
  return "ACTIVE";
}

function mapStampFeedStatus(
  status: StampRallyStatus,
  startsAt: Date | null,
  endsAt: Date | null,
): InteractionFeedStatus {
  if (status === StampRallyStatus.ENDED) return "ENDED";
  if (endsAt && endsAt.getTime() < Date.now()) return "ENDED";
  if (startsAt && startsAt.getTime() > Date.now()) return "SCHEDULED";
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
  const summary = truncateSummary(row.content);
  return {
    ...withAliases({
      id: row.id,
      type: "ANNOUNCEMENT",
      title: row.title,
      summary,
      isPinned: row.isPinned,
      status: "PUBLISHED",
      participantCount: null,
      myParticipated: false,
      publishedAt,
      startsAt: publishedAt,
      endsAt: null,
      createdAt: publishedAt,
      boothLabel: null,
      resultHint: null,
      stampedCount: null,
      requiredCount: null,
    }),
    sortAt: row.publishedAt,
  };
}

function toPollItem(poll: {
  id: string;
  title: string;
  status: PollStatus;
  scheduledAt: Date | null;
  closesAt: Date | null;
  createdAt: Date;
  _count: { responses: number };
}): SortableRow {
  const sortAt = poll.createdAt;
  const publishedAt = (poll.scheduledAt ?? poll.createdAt).toISOString();
  const status = mapPollFeedStatus(poll.status, poll.scheduledAt);
  const summary =
    status === "ENDED"
      ? `已结束 · ${poll._count.responses}人已投`
      : status === "SCHEDULED"
        ? "即将开始"
        : `进行中 · ${poll._count.responses}人已投`;
  return {
    ...withAliases({
      id: poll.id,
      type: "POLL",
      title: poll.title,
      summary,
      isPinned: false,
      status,
      participantCount: poll._count.responses,
      myParticipated: false,
      publishedAt,
      startsAt: poll.scheduledAt?.toISOString() ?? poll.createdAt.toISOString(),
      endsAt: poll.closesAt?.toISOString() ?? null,
      createdAt: poll.createdAt.toISOString(),
      boothLabel: null,
      resultHint: status === "ENDED" ? "已结束" : null,
      stampedCount: null,
      requiredCount: null,
    }),
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
  boothId: string | null;
  booth: { name: string | null; code: string | null } | null;
  prizeItems: Array<{ name: string }>;
  _count: { entries: number };
}): SortableRow {
  const sortAt = lottery.createdAt;
  const publishedAt = (lottery.drawAt ?? lottery.createdAt).toISOString();
  const status = mapLotteryFeedStatus(lottery.status, lottery.drawAt);
  const boothLabel =
    lottery.booth?.name?.trim() ||
    lottery.booth?.code?.trim() ||
    (lottery.boothId ? "展位抽奖" : "主办抽奖");
  const prizeLine = truncateSummary(lotteryPrizeSummary(lottery));
  const summary =
    status === "ENDED"
      ? `已结束 · ${lottery._count.entries}人参与`
      : status === "PENDING_DRAW"
        ? `待开奖 · ${lottery._count.entries}人已参与`
        : status === "SCHEDULED"
          ? prizeLine
          : `${prizeLine} · ${lottery._count.entries}人已参与`;
  return {
    ...withAliases({
      id: lottery.id,
      type: "LOTTERY",
      title: lottery.title,
      summary,
      isPinned: false,
      status,
      participantCount: lottery._count.entries,
      myParticipated: false,
      publishedAt,
      startsAt: lottery.createdAt.toISOString(),
      endsAt: lottery.drawAt?.toISOString() ?? null,
      createdAt: lottery.createdAt.toISOString(),
      boothLabel,
      resultHint: null,
      stampedCount: null,
      requiredCount: null,
    }),
    sortAt,
  };
}

function toStampItem(
  rally: {
    id: string;
    name: string;
    description: string | null;
    prize: string;
    requiredCount: number;
    status: StampRallyStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    booth: { name: string | null; code: string | null } | null;
  },
  stampedCount: number,
): SortableRow {
  const status = mapStampFeedStatus(rally.status, rally.startsAt, rally.endsAt);
  const publishedAt = (rally.startsAt ?? rally.createdAt).toISOString();
  const summary =
    status === "ENDED"
      ? `已结束 · ${stampedCount}/${rally.requiredCount}`
      : status === "SCHEDULED"
        ? `即将开始 · 集满 ${rally.requiredCount} 章`
        : `进行中 · ${stampedCount}/${rally.requiredCount}`;
  return {
    ...withAliases({
      id: rally.id,
      type: "STAMP",
      title: rally.name,
      summary,
      subtitle: truncateSummary(rally.description || rally.prize),
      isPinned: false,
      status,
      participantCount: null,
      myParticipated: stampedCount > 0,
      publishedAt,
      startsAt: rally.startsAt?.toISOString() ?? null,
      endsAt: rally.endsAt?.toISOString() ?? null,
      createdAt: rally.createdAt.toISOString(),
      boothLabel: rally.booth?.name?.trim() || rally.booth?.code?.trim() || null,
      resultHint:
        status === "ENDED"
          ? stampedCount >= rally.requiredCount
            ? "已集满"
            : "未完成"
          : null,
      stampedCount,
      requiredCount: rally.requiredCount,
    }),
    sortAt: rally.createdAt,
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
  const now = new Date();
  return prisma.poll.findMany({
    where: {
      eventId,
      type: { in: INTERACTIVE_POLL_TYPES },
      OR: [
        { status: { in: [PollStatus.LIVE, PollStatus.PAUSED, PollStatus.CLOSED] } },
        // 即将开始：已排期的草稿
        {
          status: PollStatus.DRAFT,
          scheduledAt: { not: null, gt: now },
        },
      ],
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
      booth: { select: { name: true, code: true } },
      prizeItems: { orderBy: { sortOrder: "asc" }, take: 3, select: { name: true } },
      _count: { select: { entries: true } },
    },
  });
}

async function fetchStampRallies(
  eventId: string,
  take: number,
  cursor: ParsedCursor | null,
) {
  return prisma.stampRally.findMany({
    where: {
      eventId,
      status: { in: DISPLAYABLE_STAMP_STATUSES },
      ...stampCursorWhere(cursor),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: {
      booth: { select: { name: true, code: true } },
    },
  });
}

async function attachParticipation(
  eventId: string,
  userId: string | null | undefined,
  items: InteractionFeedItem[],
): Promise<InteractionFeedItem[]> {
  if (!userId) return items;

  const pollIds = items.filter((i) => i.type === "POLL").map((i) => i.id);
  const lotteryIds = items.filter((i) => i.type === "LOTTERY").map((i) => i.id);
  const stampIds = items.filter((i) => i.type === "STAMP").map((i) => i.id);
  if (pollIds.length === 0 && lotteryIds.length === 0 && stampIds.length === 0) {
    return items;
  }

  const participant = await findParticipantForUser(eventId, userId);
  const [pollResponses, lotteryEntries, lotteryWins, stampProgress] =
    await Promise.all([
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
      lotteryIds.length
        ? prisma.lotteryWinner.findMany({
            where: { lotteryId: { in: lotteryIds }, userId },
            select: { lotteryId: true },
          })
        : Promise.resolve([]),
      stampIds.length
        ? prisma.userStampProgress.findMany({
            where: { rallyId: { in: stampIds }, userId },
            select: { rallyId: true, collectedCount: true },
          })
        : Promise.resolve([]),
    ]);

  // stamp records fallback if progress row missing
  const stampRecordCounts =
    stampIds.length > 0
      ? await prisma.stampRecord.groupBy({
          by: ["rallyId"],
          where: { rallyId: { in: stampIds }, userId },
          _count: { _all: true },
        })
      : [];

  const pollSet = new Set(pollResponses.map((row) => row.pollId));
  const lotterySet = new Set(lotteryEntries.map((row) => row.lotteryId));
  const winSet = new Set(lotteryWins.map((row) => row.lotteryId));
  const stampProgressMap = new Map(
    stampProgress.map((row) => [row.rallyId, row.collectedCount]),
  );
  for (const row of stampRecordCounts) {
    if (!stampProgressMap.has(row.rallyId)) {
      stampProgressMap.set(row.rallyId, row._count._all);
    }
  }

  return items.map((item) => {
    if (item.type === "POLL") {
      const myParticipated = pollSet.has(item.id);
      return withAliases({
        ...item,
        myParticipated,
        resultHint:
          item.status === "ENDED"
            ? myParticipated
              ? "已参与"
              : "你未参与"
            : item.resultHint,
      });
    }
    if (item.type === "LOTTERY") {
      const myParticipated = lotterySet.has(item.id);
      let resultHint = item.resultHint;
      if (item.status === "ENDED" && myParticipated) {
        resultHint = winSet.has(item.id) ? "恭喜中奖" : "你未中奖";
      } else if (item.status === "ENDED" && !myParticipated) {
        resultHint = "你未参与";
      }
      return withAliases({
        ...item,
        myParticipated,
        resultHint,
      });
    }
    if (item.type === "STAMP") {
      const stamped = stampProgressMap.get(item.id) ?? item.stampedCount ?? 0;
      const required = item.requiredCount ?? 0;
      return withAliases({
        ...item,
        stampedCount: stamped,
        requiredCount: required,
        myParticipated: stamped > 0,
        summary:
          item.status === "ENDED"
            ? `已结束 · ${stamped}/${required}`
            : item.status === "SCHEDULED"
              ? `即将开始 · 集满 ${required} 章`
              : `进行中 · ${stamped}/${required}`,
        resultHint:
          item.status === "ENDED"
            ? stamped >= required
              ? "已集满"
              : "未完成"
            : null,
      });
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

  if (includeAll || types.has("STAMP")) {
    fetches.push(
      fetchStampRallies(query.eventId, fetchTake, cursor).then((list) => {
        rows.push(...list.map((rally) => toStampItem(rally, 0)));
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

/** 独立公告列表（与 interactions?type=ANNOUNCEMENT 同源） */
export async function listEventAnnouncements(eventId: string, limit = 50) {
  const take = clampLimit(limit);
  const rows = await prisma.announcement.findMany({
    where: { eventId },
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

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    summary: truncateSummary(row.content),
    isPinned: row.isPinned,
    is_pinned: row.isPinned,
    publishedAt: row.publishedAt.toISOString(),
    published_at: row.publishedAt.toISOString(),
  }));
}
