import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  batchParsePendingIntents,
  loadEventTagLibrary,
  mergeParsedIntent,
  parseIntent,
} from "@/lib/ai/intent-parser";
import { embedAndSaveUserEventIntent } from "@/lib/ai/embedding";
import { isLLMConfigured } from "@/lib/ai/llm";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import { invalidateMatchBriefsForTarget } from "@/lib/ai/match-brief-service";

export type ApiMyEventIntent = {
  id: string | null;
  event_id: string;
  user_id: string;
  role: string | null;
  supply_tags: string[];
  demand_tags: string[];
  topics: string[];
  industry: string | null;
  region: string | null;
  raw_intent_text: string | null;
  intent_parsed: boolean;
  submitted: boolean;
  updated_at: string | null;
};

export type UpsertMyEventIntentInput = {
  role?: string | null;
  supply_tags?: string[];
  demand_tags?: string[];
  topics?: string[];
  industry?: string | null;
  region?: string | null;
  raw_intent_text?: string | null;
  /** true：仅保存原文，留待 batchParsePendingIntents 处理 */
  defer_llm_parse?: boolean;
};

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    industry: string | null;
    region: string | null;
    rawIntentText: string | null;
    intentParsedAt: Date | null;
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
      industry: null,
      region: null,
      raw_intent_text: null,
      intent_parsed: false,
      submitted: false,
      updated_at: null,
    };
  }

  const hasContent =
    Boolean(intent.role) ||
    intent.supplyTags.length > 0 ||
    intent.demandTags.length > 0 ||
    intent.topics.length > 0 ||
    Boolean(intent.industry) ||
    Boolean(intent.region) ||
    Boolean(intent.rawIntentText);

  return {
    id: intent.id,
    event_id: eventId,
    user_id: userId,
    role: intent.role,
    supply_tags: intent.supplyTags,
    demand_tags: intent.demandTags,
    topics: intent.topics,
    industry: intent.industry,
    region: intent.region,
    raw_intent_text: intent.rawIntentText,
    intent_parsed: Boolean(intent.intentParsedAt),
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
  const industry = normalizeOptionalString(input.industry);
  const region = normalizeOptionalString(input.region);
  const rawIntentText = normalizeOptionalString(input.raw_intent_text);

  let mergedRole = role !== undefined ? role : (existing?.role ?? null);
  let mergedSupply =
    supplyTags !== undefined ? supplyTags : (existing?.supplyTags ?? []);
  let mergedDemand =
    demandTags !== undefined ? demandTags : (existing?.demandTags ?? []);
  let mergedTopics = topics !== undefined ? topics : (existing?.topics ?? []);
  let mergedIndustry =
    industry !== undefined ? industry : (existing?.industry ?? null);
  let mergedRegion = region !== undefined ? region : (existing?.region ?? null);
  const mergedRaw =
    rawIntentText !== undefined
      ? rawIntentText
      : (existing?.rawIntentText ?? null);

  const rawChanged =
    rawIntentText !== undefined &&
    rawIntentText !== (existing?.rawIntentText ?? null);

  let intentParsedAt = existing?.intentParsedAt ?? null;

  const shouldParseNow =
    mergedRaw &&
    !input.defer_llm_parse &&
    isLLMConfigured() &&
    (rawChanged || !intentParsedAt);

  if (shouldParseNow && mergedRaw) {
    const library = await loadEventTagLibrary(eventId);
    const { eventName, allowCustomTags, ...tagLibrary } = library;

    const parsed = await parseIntent(mergedRaw, tagLibrary, {
      eventName,
      allowCustomTags,
    });

    const merged = mergeParsedIntent(
      {
        supply_tags: mergedSupply,
        demand_tags: mergedDemand,
        role: mergedRole,
        topics: mergedTopics,
        industry: mergedIndustry,
        region: mergedRegion,
      },
      parsed,
    );

    mergedSupply = merged.supply_tags;
    mergedDemand = merged.demand_tags;
    mergedRole = merged.role;
    mergedTopics = merged.topics;
    mergedIndustry = merged.industry;
    mergedRegion = merged.region;
    intentParsedAt = new Date();
  } else if (rawChanged && input.defer_llm_parse) {
    intentParsedAt = null;
  }

  const hasContent =
    Boolean(mergedRole) ||
    mergedSupply.length > 0 ||
    mergedDemand.length > 0 ||
    mergedTopics.length > 0 ||
    Boolean(mergedIndustry) ||
    Boolean(mergedRegion) ||
    Boolean(mergedRaw);

  if (!existing && !hasContent) {
    throw new ApiError(
      "请至少填写角色、标签、行业、地域或自由意向文本中的一项",
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
      industry: mergedIndustry,
      region: mergedRegion,
      rawIntentText: mergedRaw,
      intentParsedAt,
    },
    update: {
      ...(role !== undefined || shouldParseNow ? { role: mergedRole } : {}),
      ...(supplyTags !== undefined || shouldParseNow
        ? { supplyTags: mergedSupply }
        : {}),
      ...(demandTags !== undefined || shouldParseNow
        ? { demandTags: mergedDemand }
        : {}),
      ...(topics !== undefined || shouldParseNow ? { topics: mergedTopics } : {}),
      ...(industry !== undefined || shouldParseNow
        ? { industry: mergedIndustry }
        : {}),
      ...(region !== undefined || shouldParseNow ? { region: mergedRegion } : {}),
      ...(rawIntentText !== undefined ? { rawIntentText: mergedRaw } : {}),
      ...(shouldParseNow || (rawChanged && input.defer_llm_parse)
        ? { intentParsedAt }
        : {}),
    },
  });

  void invalidateMatchBriefsForTarget(userId, eventId);

  void embedAndSaveUserEventIntent(userId, eventId, {
    rawIntentText: mergedRaw,
    role: mergedRole,
    supplyTags: mergedSupply,
    demandTags: mergedDemand,
    topics: mergedTopics,
    industry: mergedIndustry,
    region: mergedRegion,
  });

  return toApiIntent(eventId, userId, intent);
}

export { batchParsePendingIntents } from "@/lib/ai/intent-parser";
export { batchEmbedPendingIntents } from "@/lib/ai/embedding";
