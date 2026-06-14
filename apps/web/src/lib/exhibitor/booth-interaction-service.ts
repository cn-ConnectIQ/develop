import {
  LotteryStatus,
  LotteryType,
  PollStatus,
  prisma,
} from "@connectiq/database";
import { type AuthSession } from "@/lib/api-auth";
import { assertExhibitorCanCreateLottery } from "@/lib/interaction/lottery-service";
import type { CreateBoothInteractionInput } from "@/lib/interaction/schemas";
import {
  createInteractionSession,
  regenerateSessionQr,
} from "@/lib/interaction/session-service";
import { getAppBaseUrl } from "@/lib/supabase/server";

export type BoothInteractionItem = {
  id: string;
  sessionCode: string;
  qrUrl: string | null;
  scanUrl: string;
  name: string;
  kind: "poll" | "lottery";
  interactionId: string;
  title: string;
  subType: string;
  status: string;
  participantCount: number;
  isActive: boolean;
  createdAt: string;
  eventId: string;
};

function buildScanUrl(sessionCode: string) {
  return `${getAppBaseUrl()}/i/${sessionCode}`;
}

export async function listBoothInteractions(
  boothId: string,
): Promise<BoothInteractionItem[]> {
  const sessions = await prisma.interactionSession.findMany({
    where: { boothId },
    orderBy: { createdAt: "desc" },
  });

  const items = await Promise.all(
    sessions.map(async (session) => {
      const refs = Array.isArray(session.interactions)
        ? (session.interactions as { type: string; id: string }[])
        : [];
      const ref = refs[0];
      if (!ref) return null;

      const base = {
        id: session.id,
        sessionCode: session.sessionCode,
        qrUrl: session.qrUrl,
        scanUrl: buildScanUrl(session.sessionCode),
        name: session.name,
        isActive: session.isActive,
        createdAt: session.createdAt.toISOString(),
        eventId: session.eventId,
      };

      if (ref.type === "poll") {
        const poll = await prisma.poll.findUnique({
          where: { id: ref.id },
          include: { _count: { select: { responses: true } } },
        });
        if (!poll) return null;
        return {
          ...base,
          kind: "poll" as const,
          interactionId: poll.id,
          title: poll.title,
          subType: poll.type,
          status: poll.status,
          participantCount: poll._count.responses,
        };
      }

      if (ref.type === "lottery") {
        const lottery = await prisma.lottery.findUnique({
          where: { id: ref.id },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            entryCount: true,
          },
        });
        if (!lottery) return null;
        return {
          ...base,
          kind: "lottery" as const,
          interactionId: lottery.id,
          title: lottery.title,
          subType: lottery.type,
          status: lottery.status,
          participantCount: lottery.entryCount,
        };
      }

      return null;
    }),
  );

  return items.flatMap((item) => (item ? [item as BoothInteractionItem] : []));
}

export async function createBoothInteraction(
  booth: { id: string; eventId: string },
  session: AuthSession,
  input: CreateBoothInteractionInput,
) {
  if (input.kind === "poll") {
    const pollStatus = input.publish_immediately
      ? PollStatus.LIVE
      : PollStatus.DRAFT;
    const closesAt =
      input.publish_immediately && input.time_limit_minutes
        ? new Date(Date.now() + input.time_limit_minutes * 60 * 1000)
        : undefined;

    const optionTexts =
      input.type === "SINGLE_CHOICE" || input.type === "MULTI_CHOICE"
        ? (input.options ?? ["选项 1", "选项 2"])
        : input.type === "RATING"
          ? ["5分", "4分", "3分", "2分", "1分"]
          : ["开放回答"];

    const poll = await prisma.poll.create({
      data: {
        eventId: booth.eventId,
        createdById: session.user.id,
        title: input.title,
        type: input.type,
        status: pollStatus,
        closesAt,
        options: {
          create: optionTexts.map((text, index) => ({
            text,
            displayOrder: index,
          })),
        },
      },
    });

    const interactionSession = await createInteractionSession({
      eventId: booth.eventId,
      createdById: session.user.id,
      name: input.title,
      interactions: [{ type: "poll", id: poll.id }],
      boothId: booth.id,
    });

    return {
      session: formatSessionPayload(interactionSession),
      interaction: {
        kind: "poll" as const,
        id: poll.id,
        title: poll.title,
        type: poll.type,
        status: poll.status,
      },
    };
  }

  await assertExhibitorCanCreateLottery(session, booth.eventId, booth.id);

  const prizes = input.prizes ?? [];
  const prizeTotal = prizes.reduce((sum, p) => sum + (p.count ?? 1), 0);
  const winnerCount = input.winner_count ?? (prizeTotal > 0 ? prizeTotal : 1);
  const lotteryStatus = input.publish_immediately
    ? LotteryStatus.OPEN
    : LotteryStatus.DRAFT;

  const lottery = await prisma.lottery.create({
    data: {
      eventId: booth.eventId,
      createdById: session.user.id,
      boothId: booth.id,
      title: input.title,
      type: input.type ?? LotteryType.RANDOM,
      status: lotteryStatus,
      prizes,
      winnerCount,
    },
  });

  const interactionSession = await createInteractionSession({
    eventId: booth.eventId,
    createdById: session.user.id,
    name: input.title,
    interactions: [{ type: "lottery", id: lottery.id }],
    boothId: booth.id,
  });

  return {
    session: formatSessionPayload(interactionSession),
    interaction: {
      kind: "lottery" as const,
      id: lottery.id,
      title: lottery.title,
      type: lottery.type,
      status: lottery.status,
    },
  };
}

function formatSessionPayload(session: {
  id: string;
  sessionCode: string;
  qrUrl: string | null;
  name: string;
}) {
  return {
    id: session.id,
    sessionCode: session.sessionCode,
    qrUrl: session.qrUrl,
    scanUrl: buildScanUrl(session.sessionCode),
    name: session.name,
  };
}

export async function regenerateBoothInteractionQr(
  boothId: string,
  sessionId: string,
) {
  return regenerateSessionQr(sessionId, boothId);
}
