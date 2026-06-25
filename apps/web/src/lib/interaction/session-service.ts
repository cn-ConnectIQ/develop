import { LotteryStatus, PollStatus, PollType, Prisma, SignalType, prisma } from "@connectiq/database";
import { ApiError } from "@/lib/api-auth";
import { getPollDisplayConfig } from "@/lib/bigscreen-service";
import { enterLottery } from "@/lib/interaction/lottery-service";
import type { InteractionRef } from "@/lib/interaction/schemas";
import { generateInteractionQR, getInteractionScanUrl } from "@/lib/qrcode";
import { ErrorCode } from "@connectiq/types";
import {
  ensureParticipantForUser,
  hasUserPollParticipation,
} from "@/lib/interaction/participant-user";
import { recordSignal } from "@/lib/signals";

const SESSION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function generateUniqueSessionCode(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    let code = "";
    for (let j = 0; j < 6; j++) {
      code += SESSION_CODE_CHARS[
        Math.floor(Math.random() * SESSION_CODE_CHARS.length)
      ];
    }
    const exists = await prisma.interactionSession.findUnique({
      where: { sessionCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new ApiError("无法生成唯一会话码", ErrorCode.INTERNAL_ERROR, 500);
}

/** @deprecated 请使用 generateInteractionQR */
export async function uploadQrImage(sessionCode: string, _scanUrl?: string) {
  return generateInteractionQR(sessionCode);
}

export async function createInteractionSession(input: {
  eventId: string;
  createdById: string;
  name: string;
  interactions: InteractionRef[];
  boothId?: string | null;
  exhibitorOrgId?: string | null;
  ownerType?: "ORGANIZER" | "EXHIBITOR";
  channelType?: "QR_CODE" | "LINK" | "APP_PUSH";
  settings?: Record<string, unknown>;
}) {
  const sessionCode = await generateUniqueSessionCode();
  const qrUrl = await generateInteractionQR(sessionCode);
  const isExhibitor = Boolean(input.boothId);

  return prisma.interactionSession.create({
    data: {
      eventId: input.eventId,
      createdById: input.createdById,
      name: input.name,
      sessionCode,
      qrUrl,
      interactions: input.interactions,
      boothId: input.boothId ?? null,
      exhibitorOrgId: input.exhibitorOrgId ?? null,
      ownerType: input.ownerType ?? (isExhibitor ? "EXHIBITOR" : "ORGANIZER"),
      channelType: input.channelType ?? "QR_CODE",
      settings: (input.settings ?? {}) as Prisma.InputJsonValue,
    },
    include: {
      booth: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function getSessionByCode(
  sessionCode: string,
  options?: { requireActive?: boolean },
) {
  const requireActive = options?.requireActive ?? true;
  const normalized = sessionCode.toUpperCase();

  const session = await prisma.interactionSession.findFirst({
    where: {
      sessionCode: { equals: normalized, mode: "insensitive" },
      ...(requireActive ? { isActive: true } : {}),
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          location: true,
          startDate: true,
          endDate: true,
        },
      },
      booth: { select: { id: true, name: true, code: true } },
    },
  });

  if (!session) {
    throw new ApiError("互动会话不存在或已关闭", ErrorCode.NOT_FOUND, 404);
  }
  return session;
}

async function resolveInteractionDetails(
  eventId: string,
  interactions: unknown,
) {
  const refs = Array.isArray(interactions)
    ? (interactions as InteractionRef[])
    : [];

  const resolved = await Promise.all(
    refs.map(async (ref) => {
      if (ref.type === "poll") {
        const poll = await prisma.poll.findFirst({
          where: { id: ref.id, eventId },
          include: {
            options: { orderBy: { displayOrder: "asc" } },
            _count: { select: { responses: true } },
          },
        });
        return poll ? { type: "poll" as const, data: poll } : null;
      }

      if (ref.type === "lottery") {
        const lottery = await prisma.lottery.findFirst({
          where: { id: ref.id, eventId },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            status: true,
            prizes: true,
            entryCount: true,
            winnerCount: true,
          },
        });
        return lottery ? { type: "lottery" as const, data: lottery } : null;
      }

      return null;
    }),
  );

  return resolved.filter(
    (item): item is NonNullable<(typeof resolved)[number]> => item !== null,
  );
}

function formatSessionPayload(
  session: Awaited<ReturnType<typeof getSessionByCode>>,
  interactions: Awaited<ReturnType<typeof resolveInteractionDetails>>,
) {
  return {
    session: {
      id: session.id,
      name: session.name,
      sessionCode: session.sessionCode,
      qrUrl: session.qrUrl,
      channelType: session.channelType,
      scanCount: session.scanCount,
      participantCount: session.participantCount,
      isActive: session.isActive,
    },
    event: session.event,
    booth: session.booth,
    interactions: interactions.map((item) => {
      if (item.type === "poll") {
        return {
          type: "poll" as const,
          data: {
            id: item.data.id,
            title: item.data.title,
            type: item.data.type,
            status: item.data.status,
            closesAt: item.data.closesAt?.toISOString() ?? null,
            options: item.data.options,
            _count: item.data._count,
          },
        };
      }
      return item;
    }),
  };
}

/** 落地页 SSR：不增加 scan_count */
export async function getInteractionSessionPageData(sessionCode: string) {
  const session = await prisma.interactionSession.findFirst({
    where: {
      sessionCode: { equals: sessionCode.toUpperCase(), mode: "insensitive" },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          location: true,
          startDate: true,
          endDate: true,
        },
      },
      booth: { select: { id: true, name: true, code: true } },
    },
  });

  if (!session || !session.isActive) {
    return null;
  }

  const interactions = await resolveInteractionDetails(
    session.eventId,
    session.interactions,
  );

  return formatSessionPayload(session, interactions);
}

export async function getPublicSessionPayload(sessionCode: string) {
  const session = await getSessionByCode(sessionCode);

  await prisma.interactionSession.update({
    where: { id: session.id },
    data: { scanCount: { increment: 1 } },
  });

  const interactions = await resolveInteractionDetails(
    session.eventId,
    session.interactions,
  );

  return formatSessionPayload(
    { ...session, scanCount: session.scanCount + 1 },
    interactions,
  );
}

export async function regenerateSessionQr(sessionId: string, boothId: string) {
  const session = await prisma.interactionSession.findFirst({
    where: { id: sessionId, boothId },
  });

  if (!session) {
    throw new ApiError("互动会话不存在", ErrorCode.NOT_FOUND, 404);
  }

  const qrUrl = await generateInteractionQR(session.sessionCode);
  const updated = await prisma.interactionSession.update({
    where: { id: sessionId },
    data: { qrUrl },
  });

  return {
    sessionId: updated.id,
    sessionCode: updated.sessionCode,
    qrUrl: updated.qrUrl,
    scanUrl: getInteractionScanUrl(updated.sessionCode),
  };
}

export type PollParticipationInput = {
  poll_id: string;
  option_id?: string;
  option_ids?: string[];
  text_answer?: string;
  rating?: number;
};

export async function participateInSession(
  sessionCode: string,
  userId?: string | null,
  pollInput?: PollParticipationInput,
) {
  const session = await getSessionByCode(sessionCode);
  const refs = Array.isArray(session.interactions)
    ? (session.interactions as InteractionRef[])
    : [];

  const updated = await prisma.interactionSession.update({
    where: { id: session.id },
    data: { participantCount: { increment: 1 } },
    select: {
      id: true,
      sessionCode: true,
      participantCount: true,
      eventId: true,
    },
  });

  const lotteryEntries: unknown[] = [];
  let pollResponse: unknown = null;

  if (userId) {
    recordSignal(
      userId,
      session.eventId,
      SignalType.INTERACTION_JOINED,
      session.id,
      "INTERACTION",
      { session_code: sessionCode },
    );

    for (const ref of refs) {
      if (ref.type === "lottery") {
        try {
          const entry = await enterLottery(
            session.eventId,
            ref.id,
            userId,
          );
          lotteryEntries.push(entry);

          const settings =
            session.settings &&
            typeof session.settings === "object" &&
            !Array.isArray(session.settings)
              ? (session.settings as Record<string, unknown>)
              : {};
          if (settings.requireLeadCapture === true && session.boothId) {
            const participant = await ensureParticipantForUser(
              session.eventId,
              userId,
            );
            if (participant) {
              const existingLead = await prisma.lead.findFirst({
                where: {
                  boothId: session.boothId,
                  participantId: participant.id,
                },
              });
              if (!existingLead) {
                await prisma.lead.create({
                  data: {
                    boothId: session.boothId,
                    participantId: participant.id,
                    notes: "展位抽奖留资",
                  },
                });
              }
            }
          }
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.message.includes("已参与")
          ) {
            continue;
          }
          throw error;
        }
      }
    }

    if (pollInput) {
      pollResponse = await submitPollResponse(
        session.eventId,
        userId,
        pollInput,
      );
    }
  }

  return {
    ...updated,
    userId: userId ?? null,
    lotteryEntries,
    pollResponse,
  };
}

export async function submitPollResponse(
  eventId: string,
  userId: string,
  input: PollParticipationInput,
) {
  const poll = await prisma.poll.findFirst({
    where: { id: input.poll_id, eventId },
    include: { options: true },
  });

  if (!poll) {
    throw new ApiError("投票不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (poll.status !== PollStatus.LIVE) {
    throw new ApiError("投票未开放", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (poll.closesAt && poll.closesAt < new Date()) {
    throw new ApiError("投票已结束", ErrorCode.VALIDATION_ERROR, 400);
  }

  const display = await getPollDisplayConfig(eventId, poll.id);
  if (display.lockVotes) {
    throw new ApiError("投票已锁定，暂不可提交", ErrorCode.VALIDATION_ERROR, 400);
  }

  const participant = await ensureParticipantForUser(eventId, userId);

  const existing = await prisma.pollResponse.findFirst({
    where: {
      pollId: poll.id,
      participantId: participant?.id ?? undefined,
    },
  });

  if (existing && poll.type !== "WORD_CLOUD") {
    throw new ApiError("您已参与过该投票", ErrorCode.VALIDATION_ERROR, 400);
  }

  const optionLabel = (optionId: string | null | undefined) =>
    poll.options.find((o) => o.id === optionId)?.text ?? optionId ?? "";

  let result: unknown;

  if (poll.type === "MULTI_CHOICE" && input.option_ids?.length) {
    result = await prisma.$transaction(
      input.option_ids.map((optionId) =>
        prisma.pollResponse.create({
          data: {
            pollId: poll.id,
            participantId: participant?.id ?? null,
            optionId,
          },
        }),
      ),
    );
    recordSignal(userId, eventId, SignalType.POLL_ANSWERED, poll.id, "POLL", {
      selected_options: input.option_ids.map((id) => optionLabel(id)),
      poll_title: poll.title,
    });
    return result;
  }

  result = await prisma.pollResponse.create({
    data: {
      pollId: poll.id,
      participantId: participant?.id ?? null,
      optionId: input.option_id ?? null,
      textAnswer: input.text_answer ?? null,
      rating: input.rating ?? null,
    },
  });

  if (poll.type === PollType.QNA && input.text_answer?.trim()) {
    const duplicate = await prisma.pollResponse.findFirst({
      where: {
        pollId: poll.id,
        textAnswer: { equals: input.text_answer.trim(), mode: "insensitive" },
        NOT: { id: (result as { id: string }).id },
      },
      select: { id: true },
    });
    if (duplicate) {
      recordSignal(userId, eventId, SignalType.QNA_UPVOTED, duplicate.id, "QNA", {
        question_text: input.text_answer.trim(),
        poll_id: poll.id,
      });
    } else {
      recordSignal(userId, eventId, SignalType.QNA_ASKED, poll.id, "QNA", {
        question_text: input.text_answer.trim(),
      });
    }
    return result;
  }

  const selected =
    input.option_id != null
      ? [optionLabel(input.option_id)]
      : input.text_answer
        ? [input.text_answer]
        : input.rating != null
          ? [`评分 ${input.rating}`]
          : [];

  recordSignal(userId, eventId, SignalType.POLL_ANSWERED, poll.id, "POLL", {
    selected_options: selected,
    poll_title: poll.title,
  });

  return result;
}

/** @deprecated 使用 participateInSession */
export async function joinInteractionSession(
  sessionCode: string,
  userId?: string | null,
) {
  return participateInSession(sessionCode, userId);
}

export async function hasUserSubmittedPoll(
  eventId: string,
  userId: string,
  pollId: string,
) {
  return hasUserPollParticipation(eventId, userId, pollId);
}
