import { SnSessionStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiSnSessionRow = {
  id: string;
  event_id: string;
  status: SnSessionStatus;
  round_count: number;
  pair_count: number;
  connection_count: number;
  participant_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

const STATUS_ORDER: Record<SnSessionStatus, number> = {
  IN_PROGRESS: 0,
  SCHEDULED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

function mapSession(
  session: {
    id: string;
    eventId: string;
    status: SnSessionStatus;
    roundCount: number;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    pairs: Array<{ connectionEstablished: boolean; participantAId: string; participantBId: string }>;
  },
): ApiSnSessionRow {
  const participantIds = new Set<string>();
  let connectionCount = 0;

  for (const pair of session.pairs) {
    participantIds.add(pair.participantAId);
    participantIds.add(pair.participantBId);
    if (pair.connectionEstablished) connectionCount++;
  }

  return {
    id: session.id,
    event_id: session.eventId,
    status: session.status,
    round_count: session.roundCount,
    pair_count: session.pairs.length,
    connection_count: connectionCount,
    participant_count: participantIds.size,
    started_at: session.startedAt?.toISOString() ?? null,
    ended_at: session.endedAt?.toISOString() ?? null,
    created_at: session.createdAt.toISOString(),
  };
}

export async function listEventSnSessions(
  eventId: string,
): Promise<ApiSnSessionRow[]> {
  const sessions = await prisma.snSession.findMany({
    where: { eventId },
    include: {
      pairs: {
        select: {
          connectionEstablished: true,
          participantAId: true,
          participantBId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return sessions
    .map(mapSession)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export async function createEventSnSession(
  eventId: string,
  roundCount: number,
): Promise<ApiSnSessionRow> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const active = await prisma.snSession.findFirst({
    where: {
      eventId,
      status: { in: [SnSessionStatus.SCHEDULED, SnSessionStatus.IN_PROGRESS] },
    },
    select: { id: true },
  });
  if (active) {
    throw new ApiError(
      "已有进行中的 SN 场次，请先结束或取消后再创建",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const session = await prisma.snSession.create({
    data: {
      eventId,
      roundCount,
      status: SnSessionStatus.SCHEDULED,
    },
    include: {
      pairs: {
        select: {
          connectionEstablished: true,
          participantAId: true,
          participantBId: true,
        },
      },
    },
  });

  return mapSession(session);
}

export type UpdateSnSessionInput = {
  status?: SnSessionStatus;
  round_count?: number;
};

export async function updateEventSnSession(
  eventId: string,
  sessionId: string,
  input: UpdateSnSessionInput,
): Promise<ApiSnSessionRow> {
  const existing = await prisma.snSession.findFirst({
    where: { id: sessionId, eventId },
    include: {
      pairs: {
        select: {
          connectionEstablished: true,
          participantAId: true,
          participantBId: true,
        },
      },
    },
  });

  if (!existing) {
    throw new ApiError("SN 场次不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (input.status === SnSessionStatus.IN_PROGRESS) {
    const otherActive = await prisma.snSession.findFirst({
      where: {
        eventId,
        id: { not: sessionId },
        status: SnSessionStatus.IN_PROGRESS,
      },
      select: { id: true },
    });
    if (otherActive) {
      throw new ApiError(
        "已有进行中的 SN 场次",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
  }

  if (
    input.round_count !== undefined &&
    existing.status !== SnSessionStatus.SCHEDULED
  ) {
    throw new ApiError(
      "仅未开始的场次可修改轮次数",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const now = new Date();
  const data: {
    status?: SnSessionStatus;
    roundCount?: number;
    startedAt?: Date | null;
    endedAt?: Date | null;
  } = {};

  if (input.round_count !== undefined) {
    data.roundCount = input.round_count;
  }

  if (input.status !== undefined) {
    data.status = input.status;

    if (input.status === SnSessionStatus.IN_PROGRESS) {
      data.startedAt = existing.startedAt ?? now;
      data.endedAt = null;
    } else if (
      input.status === SnSessionStatus.COMPLETED ||
      input.status === SnSessionStatus.CANCELLED
    ) {
      data.endedAt = existing.endedAt ?? now;
    }
  }

  const updated = await prisma.snSession.update({
    where: { id: sessionId },
    data,
    include: {
      pairs: {
        select: {
          connectionEstablished: true,
          participantAId: true,
          participantBId: true,
        },
      },
    },
  });

  return mapSession(updated);
}
