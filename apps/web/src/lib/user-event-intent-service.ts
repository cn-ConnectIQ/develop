import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";

export type ApiMyEventIntent = {
  id: string | null;
  event_id: string;
  user_id: string;
  role: string | null;
  supply_tags: string[];
  demand_tags: string[];
  topics: string[];
  submitted: boolean;
  updated_at: string | null;
};

export type UpsertMyEventIntentInput = {
  role?: string | null;
  supply_tags?: string[];
  demand_tags?: string[];
  topics?: string[];
};

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

function toApiIntent(
  eventId: string,
  userId: string,
  intent: {
    id: string;
    role: string | null;
    supplyTags: string[];
    demandTags: string[];
    topics: string[];
    updatedAt: Date;
  } | null,
): ApiMyEventIntent {
  if (!intent) {
    return {
      id: null,
      event_id: eventId,
      user_id: userId,
      role: null,
      supply_tags: [],
      demand_tags: [],
      topics: [],
      submitted: false,
      updated_at: null,
    };
  }

  const hasContent =
    Boolean(intent.role) ||
    intent.supplyTags.length > 0 ||
    intent.demandTags.length > 0 ||
    intent.topics.length > 0;

  return {
    id: intent.id,
    event_id: eventId,
    user_id: userId,
    role: intent.role,
    supply_tags: intent.supplyTags,
    demand_tags: intent.demandTags,
    topics: intent.topics,
    submitted: hasContent,
    updated_at: intent.updatedAt.toISOString(),
  };
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
}

export async function getMyEventIntent(
  eventId: string,
  userId: string,
): Promise<ApiMyEventIntent> {
  await assertEventExists(eventId);

  const participant = await ensureParticipantForUser(eventId, userId);
  if (!participant) {
    throw new ApiError("您尚未报名该活动", ErrorCode.FORBIDDEN, 403);
  }

  const intent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  return toApiIntent(eventId, userId, intent);
}

export async function upsertMyEventIntent(
  eventId: string,
  userId: string,
  input: UpsertMyEventIntentInput,
): Promise<ApiMyEventIntent> {
  await assertEventExists(eventId);

  const participant = await ensureParticipantForUser(eventId, userId);
  if (!participant) {
    throw new ApiError("您尚未报名该活动", ErrorCode.FORBIDDEN, 403);
  }

  const existing = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  const supplyTags =
    input.supply_tags !== undefined
      ? normalizeTags(input.supply_tags)
      : undefined;
  const demandTags =
    input.demand_tags !== undefined
      ? normalizeTags(input.demand_tags)
      : undefined;
  const topics =
    input.topics !== undefined ? normalizeTags(input.topics) : undefined;
  const role =
    input.role === undefined
      ? undefined
      : input.role === null
        ? null
        : input.role.trim() || null;

  const mergedRole = role !== undefined ? role : (existing?.role ?? null);
  const mergedSupply =
    supplyTags !== undefined ? supplyTags : (existing?.supplyTags ?? []);
  const mergedDemand =
    demandTags !== undefined ? demandTags : (existing?.demandTags ?? []);
  const mergedTopics = topics !== undefined ? topics : (existing?.topics ?? []);

  const hasContent =
    Boolean(mergedRole) ||
    mergedSupply.length > 0 ||
    mergedDemand.length > 0 ||
    mergedTopics.length > 0;

  if (!existing && !hasContent) {
    throw new ApiError(
      "请至少填写角色、供给标签、需求标签或话题中的一项",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const intent = await prisma.userEventIntent.upsert({
    where: { userId_eventId: { userId, eventId } },
    create: {
      userId,
      eventId,
      role: mergedRole,
      supplyTags: mergedSupply,
      demandTags: mergedDemand,
      topics: mergedTopics,
    },
    update: {
      ...(role !== undefined ? { role } : {}),
      ...(supplyTags !== undefined ? { supplyTags } : {}),
      ...(demandTags !== undefined ? { demandTags } : {}),
      ...(topics !== undefined ? { topics } : {}),
    },
  });

  return toApiIntent(eventId, userId, intent);
}
