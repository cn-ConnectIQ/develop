import { EventStatus, EventType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  categoryToDbType,
  type EventCategory,
} from "@/lib/event-utils";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.enum(["SUMMIT", "EXPO", "SALON", "TRAINING"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  city: z.string().optional(),
  venue: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { event } = await requireEventAccess(eventId);

  const review = await prisma.eventReview.findUnique({
    where: { eventId },
  });

  const categorySetting = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: "event_category" } },
  });

  return createSuccessResponse({
    id: event.id,
    name: event.name,
    slug: event.slug,
    type: event.type,
    status: event.status,
    reviewStatus: event.reviewStatus,
    description: event.description,
    location: event.location,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    category:
      typeof categorySetting?.value === "string"
        ? (categorySetting.value as EventCategory)
        : null,
    review: review
      ? {
          status: review.status,
          revisionNotes: review.revisionNotes,
          rejectionReason: review.rejectionReason,
        }
      : null,
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { event } = await requireEventAccess(eventId);

  if (event.reviewStatus === "PENDING_REVIEW") {
    return createErrorResponse(
      "审核中的活动不可修改",
      ErrorCode.FORBIDDEN,
      403,
    );
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const data = parsed.data;
  const locationParts = [data.city?.trim(), data.venue?.trim()].filter(Boolean);
  const location =
    data.location?.trim() ||
    (locationParts.length > 0 ? locationParts.join(" · ") : undefined);

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(location !== undefined ? { location } : {}),
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
      status: EventStatus.DRAFT,
      reviewStatus:
        event.reviewStatus === "REVISION_REQUIRED" ||
        event.reviewStatus === "REJECTED"
          ? "DRAFT"
          : event.reviewStatus,
    },
  });

  if (data.category) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: "event_category" } },
      create: {
        eventId,
        key: "event_category",
        value: data.category,
      },
      update: { value: data.category },
    });
  }

  return createSuccessResponse({
    id: updated.id,
    name: updated.name,
    status: updated.status,
    reviewStatus: updated.reviewStatus,
    startDate: updated.startDate?.toISOString() ?? null,
    endDate: updated.endDate?.toISOString() ?? null,
    location: updated.location,
    description: updated.description,
  });
});
