import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import {
  mergeEventFeatureFlags,
  parseEventFeatureFlags,
  toApiFeatureFlags,
} from "@/lib/event-feature-flags";
import { loadEventFeatureFlags } from "@/lib/event-feature-flags-server";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await resolveMobileUserId(request);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, featureFlags: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const response = createSuccessResponse({
    event_id: eventId,
    feature_flags: toApiFeatureFlags(parseEventFeatureFlags(event.featureFlags)),
  });
  response.headers.set(
    "Cache-Control",
    "private, max-age=60, stale-while-revalidate=300",
  );
  return response;
});

const patchSchema = z
  .object({
    speedNetworking: z.boolean().optional(),
    lottery: z.boolean().optional(),
    aiBoothRoute: z.boolean().optional(),
    aiReferral: z.boolean().optional(),
    highValueBuyerPush: z.boolean().optional(),
    stampRally: z.boolean().optional(),
    boothRanking: z.boolean().optional(),
    eventSummary: z.boolean().optional(),
    inviteSystem: z.boolean().optional(),
  })
  .partial();

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { featureFlags: true },
  });
  if (!existing) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const next = mergeEventFeatureFlags(existing.featureFlags, parsed.data);

  await prisma.event.update({
    where: { id: eventId },
    data: { featureFlags: next },
  });

  return createSuccessResponse({
    event_id: eventId,
    feature_flags: toApiFeatureFlags(next),
  });
});

export { loadEventFeatureFlags };
