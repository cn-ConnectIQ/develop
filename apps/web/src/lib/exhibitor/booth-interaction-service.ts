import {
  LotteryStatus,
  LotteryType,
  PollStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import { assertExhibitorCanCreateLottery } from "@/lib/interaction/lottery-service";
import { drawLotteryWinners } from "@/lib/interaction/lottery-service";
import type {
  CreateBoothInteractionInput,
  InteractionRef,
} from "@/lib/interaction/schemas";
import type { PatchBoothInteractionInput } from "@/lib/interaction/schemas";
import {
  createInteractionSession,
  regenerateSessionQr,
} from "@/lib/interaction/session-service";
import { getPollRealtimeResults } from "@/lib/poll-realtime-results";
import { getAppBaseUrl } from "@/lib/supabase/server";
import {
  boothInteractionGroupStatus,
  type BoothInteractionItem,
} from "@/lib/exhibitor/booth-interaction-types";

export type { BoothInteractionItem };
export { boothInteractionGroupStatus };

function buildScanUrl(sessionCode: string) {
  return `${getAppBaseUrl()}/i/${sessionCode}`;
}

function parseSessionSettings(raw: unknown): {
  requireLeadCapture?: boolean;
  qnaModeration?: boolean;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  return {
    requireLeadCapture: obj.requireLeadCapture === true,
    qnaModeration: obj.qnaModeration === true,
  };
}

async function resolveSessionItem(
  session: {
    id: string;
    sessionCode: string;
    qrUrl: string | null;
    name: string;
    ownerType: string;
    isActive: boolean;
    settings: unknown;
    createdAt: Date;
    eventId: string;
    interactions: unknown;
  },
): Promise<BoothInteractionItem | null> {
  const refs = Array.isArray(session.interactions)
    ? (session.interactions as InteractionRef[])
    : [];
  const ref = refs[0];
  if (!ref) return null;

  const settings = parseSessionSettings(session.settings);
  const base = {
    id: session.id,
    sessionCode: session.sessionCode,
    qrUrl: session.qrUrl,
    scanUrl: buildScanUrl(session.sessionCode),
    name: session.name,
    ownerType: session.ownerType,
    isActive: session.isActive,
    requireLeadCapture: settings.requireLeadCapture ?? false,
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
}

export async function listBoothInteractions(
  boothId: string,
): Promise<BoothInteractionItem[]> {
  const sessions = await prisma.interactionSession.findMany({
    where: { boothId },
    orderBy: { createdAt: "desc" },
  });

  const items = await Promise.all(sessions.map(resolveSessionItem));
  return items.flatMap((item) => (item ? [item] : []));
}

export async function getBoothInteractionSession(
  boothId: string,
  sessionId: string,
) {
  const session = await prisma.interactionSession.findFirst({
    where: { id: sessionId, boothId },
  });
  if (!session) {
    throw new ApiError("互动不存在", ErrorCode.NOT_FOUND, 404);
  }
  const item = await resolveSessionItem(session);
  if (!item) {
    throw new ApiError("互动数据异常", ErrorCode.NOT_FOUND, 404);
  }
  return item;
}

export async function createBoothInteraction(
  booth: { id: string; eventId: string; companyOrgId: string },
  session: AuthSession,
  input: CreateBoothInteractionInput,
) {
  const sessionSettings: Record<string, unknown> = {};

  if (input.kind === "poll") {
    const pollStatus = input.publish_immediately
      ? PollStatus.LIVE
      : PollStatus.DRAFT;
    const closesAt =
      input.publish_immediately && input.time_limit_minutes
        ? new Date(Date.now() + input.time_limit_minutes * 60 * 1000)
        : undefined;

    if (input.qna_moderation) {
      sessionSettings.qnaModeration = true;
    }

    const optionTexts =
      input.type === "SINGLE_CHOICE" || input.type === "MULTI_CHOICE"
        ? (input.options ?? ["选项 1", "选项 2"])
        : input.type === "RATING"
          ? ["5分", "4分", "3分", "2分", "1分"]
          : input.type === "QNA"
            ? ["开放提问"]
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
      exhibitorOrgId: booth.companyOrgId,
      ownerType: "EXHIBITOR",
      settings: sessionSettings,
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

  if (input.require_lead_capture) {
    sessionSettings.requireLeadCapture = true;
  }

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
    exhibitorOrgId: booth.companyOrgId,
    ownerType: "EXHIBITOR",
    settings: sessionSettings,
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

export async function patchBoothInteraction(
  boothId: string,
  sessionId: string,
  input: PatchBoothInteractionInput,
) {
  const item = await getBoothInteractionSession(boothId, sessionId);

  if (input.title) {
    if (item.kind === "poll") {
      await prisma.poll.update({
        where: { id: item.interactionId },
        data: { title: input.title },
      });
    } else {
      await prisma.lottery.update({
        where: { id: item.interactionId },
        data: { title: input.title },
      });
    }
    await prisma.interactionSession.update({
      where: { id: sessionId },
      data: { name: input.title },
    });
  }

  if (input.is_active !== undefined) {
    await prisma.interactionSession.update({
      where: { id: sessionId },
      data: { isActive: input.is_active },
    });
  }

  if (item.kind === "poll") {
    if (input.publish) {
      await prisma.poll.update({
        where: { id: item.interactionId },
        data: { status: PollStatus.LIVE },
      });
    }
    if (input.pause) {
      await prisma.poll.update({
        where: { id: item.interactionId },
        data: { status: PollStatus.PAUSED },
      });
    }
    if (input.close) {
      await prisma.poll.update({
        where: { id: item.interactionId },
        data: { status: PollStatus.CLOSED },
      });
    }
  } else {
    if (input.publish) {
      await prisma.lottery.update({
        where: { id: item.interactionId },
        data: { status: LotteryStatus.OPEN },
      });
    }
    if (input.close) {
      await prisma.lottery.update({
        where: { id: item.interactionId },
        data: { status: LotteryStatus.FINISHED },
      });
    }
  }

  return getBoothInteractionSession(boothId, sessionId);
}

export async function getBoothInteractionResults(
  boothId: string,
  sessionId: string,
) {
  const session = await prisma.interactionSession.findFirst({
    where: { id: sessionId, boothId },
  });
  if (!session) {
    throw new ApiError("互动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const item = await resolveSessionItem(session);
  if (!item) {
    throw new ApiError("互动数据异常", ErrorCode.NOT_FOUND, 404);
  }

  const leadCount = await prisma.lead.count({
    where: {
      boothId,
      createdAt: { gte: session.createdAt },
    },
  });

  if (item.kind === "poll") {
    const pollResults = await getPollRealtimeResults(
      session.eventId,
      item.interactionId,
    );
    return {
      kind: "poll" as const,
      session: item,
      leadCount,
      poll: pollResults,
    };
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: item.interactionId },
    include: {
      winners: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profile: { select: { company: true } },
            },
          },
        },
        orderBy: { prizeRank: "asc" },
      },
    },
  });

  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  return {
    kind: "lottery" as const,
    session: item,
    leadCount,
    lottery: {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      entryCount: lottery.entryCount,
      prizes: lottery.prizes,
      winners: lottery.winners.map((w) => ({
        id: w.id,
        prizeRank: w.prizeRank,
        prizeName: w.prizeName,
        userName: w.user.name,
        userCompany: w.user.profile?.company ?? null,
        drawnAt: w.drawnAt.toISOString(),
      })),
    },
  };
}

export async function drawBoothLottery(
  boothId: string,
  sessionId: string,
  prizeRank: number,
  count = 1,
) {
  const item = await getBoothInteractionSession(boothId, sessionId);
  if (item.kind !== "lottery") {
    throw new ApiError("该互动不是抽奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  const winners = await drawLotteryWinners(
    item.eventId,
    item.interactionId,
    prizeRank,
    count,
  );

  return { winners, total: winners.length };
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
