import { prisma } from "@connectiq/database";
import type { BigscreenDisplayConfig } from "@/lib/bigscreen-display";
import { getPollDisplayConfig } from "@/lib/bigscreen-service";

export type QnaParticipant = {
  id: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
};

export type QnaResponseItem = {
  id: string;
  textAnswer: string;
  createdAt: string;
  isOnScreen: boolean;
  upvoteCount: number;
  isAnswered: boolean;
  isHidden: boolean;
  isPinned: boolean;
  participant: QnaParticipant | null;
  hostNote: string | null;
  publicReply: string | null;
  tags: string[];
};

export type QnaListResult = {
  poll: {
    id: string;
    title: string;
    status: string;
    showResults: boolean;
  };
  display: BigscreenDisplayConfig;
  onScreenResponse: QnaResponseItem | null;
  responses: QnaResponseItem[];
};

function buildUpvoteMap(
  responses: Array<{ textAnswer: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of responses) {
    const text = r.textAnswer?.trim();
    if (!text) continue;
    map.set(text, (map.get(text) ?? 0) + 1);
  }
  return map;
}

function toQnaItem(
  row: {
    id: string;
    textAnswer: string | null;
    isOnScreen: boolean;
    createdAt: Date;
    participant: QnaParticipant | null;
  },
  display: BigscreenDisplayConfig,
  upvoteMap: Map<string, number>,
): QnaResponseItem | null {
  const text = row.textAnswer?.trim();
  if (!text) return null;

  const meta = display.responseMeta?.[row.id];

  return {
    id: row.id,
    textAnswer: text,
    createdAt: row.createdAt.toISOString(),
    isOnScreen: row.isOnScreen,
    upvoteCount: upvoteMap.get(text) ?? 1,
    isAnswered: display.answeredResponseIds.includes(row.id),
    isHidden: display.hiddenResponseIds.includes(row.id),
    isPinned: display.pinnedResponseIds.includes(row.id),
    participant: row.participant,
    hostNote: meta?.hostNote ?? null,
    publicReply: meta?.publicReply ?? null,
    tags: meta?.tags ?? [],
  };
}

export async function listQnaResponses(
  eventId: string,
  pollId: string,
): Promise<QnaListResult | null> {
  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId, type: "QNA" },
    select: {
      id: true,
      title: true,
      status: true,
      showResults: true,
    },
  });

  if (!poll) return null;

  const [display, rows] = await Promise.all([
    getPollDisplayConfig(eventId, pollId, poll.showResults),
    prisma.pollResponse.findMany({
      where: { pollId },
      orderBy: { createdAt: "desc" },
      include: {
        participant: {
          select: {
            id: true,
            name: true,
            company: true,
            jobTitle: true,
          },
        },
      },
    }),
  ]);

  const upvoteMap = buildUpvoteMap(rows);
  const responses = rows
    .map((row) => toQnaItem(row, display, upvoteMap))
    .filter((r): r is QnaResponseItem => r != null);

  const onScreenRow = rows.find((r) => r.isOnScreen);
  const onScreenResponse = onScreenRow
    ? toQnaItem(onScreenRow, display, upvoteMap)
    : null;

  return {
    poll,
    display,
    onScreenResponse,
    responses,
  };
}

export async function markAllQnaAnswered(eventId: string, pollId: string) {
  const list = await listQnaResponses(eventId, pollId);
  if (!list) return null;

  const allIds = list.responses.map((r) => r.id);
  return {
    answeredResponseIds: allIds,
  } satisfies Partial<BigscreenDisplayConfig>;
}
