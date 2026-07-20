import {
  EventReviewStatus,
  EventStatus,
  ReviewStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

/**
 * 活动对外生命周期唯一写入口。
 * `status`（小程序/参会端）是唯一真相；`reviewStatus` 仅作镜像字段，必须经
 * `eventLifecycleFields` 成对写入，禁止只改一侧。
 */
export type EventLifecyclePhase = "DRAFT" | "PUBLISHED" | "LIVE" | "ARCHIVED";

export function eventLifecycleFields(phase: EventLifecyclePhase): {
  status: EventStatus;
  reviewStatus: ReviewStatus;
} {
  switch (phase) {
    case "DRAFT":
      return { status: EventStatus.DRAFT, reviewStatus: ReviewStatus.DRAFT };
    case "PUBLISHED":
      return {
        status: EventStatus.PUBLISHED,
        reviewStatus: ReviewStatus.PUBLISHED,
      };
    case "LIVE":
      return { status: EventStatus.LIVE, reviewStatus: ReviewStatus.LIVE };
    case "ARCHIVED":
      return { status: EventStatus.ARCHIVED, reviewStatus: ReviewStatus.ENDED };
  }
}

/** 由 status 推导应有的 reviewStatus（status 为唯一真相） */
export function reviewStatusForEventStatus(status: EventStatus): ReviewStatus {
  switch (status) {
    case EventStatus.DRAFT:
      return ReviewStatus.DRAFT;
    case EventStatus.PUBLISHED:
      return ReviewStatus.PUBLISHED;
    case EventStatus.LIVE:
      return ReviewStatus.LIVE;
    case EventStatus.ARCHIVED:
      return ReviewStatus.ENDED;
    default:
      return ReviewStatus.DRAFT;
  }
}

export function isLifecyclePairConsistent(
  status: EventStatus,
  reviewStatus: ReviewStatus,
): boolean {
  return reviewStatusForEventStatus(status) === reviewStatus;
}

/** 将 reviewStatus 强制对齐到 status，修复历史脏数据 */
export async function reconcileEventLifecyclePair(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  const expected = reviewStatusForEventStatus(event.status);
  if (event.reviewStatus === expected) return event;
  return prisma.event.update({
    where: { id: eventId },
    data: { reviewStatus: expected },
  });
}

async function loadEventOrThrow(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (!isLifecyclePairConsistent(event.status, event.reviewStatus)) {
    return reconcileEventLifecyclePair(eventId);
  }
  return event;
}

export async function archiveEvent(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  if (event.status === EventStatus.ARCHIVED) {
    return event;
  }
  if (event.status === EventStatus.DRAFT) {
    throw new ApiError("草稿活动请直接删除", ErrorCode.VALIDATION_ERROR, 400);
  }
  return prisma.event.update({
    where: { id: eventId },
    data: eventLifecycleFields("ARCHIVED"),
  });
}

/** 将已发布活动设为进行中（LIVE），用于现场运营与发现排序 */
export async function goLiveEvent(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  if (event.status === EventStatus.LIVE) {
    return event;
  }
  if (
    event.status !== EventStatus.PUBLISHED &&
    event.status !== EventStatus.ARCHIVED
  ) {
    throw new ApiError(
      "仅已发布或已归档的活动可设为进行中",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
  return prisma.event.update({
    where: { id: eventId },
    data: eventLifecycleFields("LIVE"),
  });
}

/** 结束进行中状态，回到已发布（不归档） */
export async function endLiveEvent(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  if (event.status === EventStatus.PUBLISHED) {
    return event;
  }
  if (event.status !== EventStatus.LIVE) {
    throw new ApiError(
      "仅进行中的活动可结束现场状态",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
  return prisma.event.update({
    where: { id: eventId },
    data: eventLifecycleFields("PUBLISHED"),
  });
}

/** 从归档恢复为已发布 */
export async function unarchiveEvent(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  if (event.status !== EventStatus.ARCHIVED) {
    throw new ApiError("仅已归档活动可恢复发布", ErrorCode.VALIDATION_ERROR, 400);
  }
  return prisma.event.update({
    where: { id: eventId },
    data: eventLifecycleFields("PUBLISHED"),
  });
}

export async function deleteEvent(eventId: string) {
  const event = await loadEventOrThrow(eventId);
  const review = await prisma.eventReview.findUnique({ where: { eventId } });
  if (review?.status === EventReviewStatus.PENDING_REVIEW) {
    throw new ApiError("审核中的活动不可删除", ErrorCode.FORBIDDEN, 403);
  }
  if (event.status !== EventStatus.DRAFT) {
    throw new ApiError("仅草稿活动可删除，请先归档", ErrorCode.VALIDATION_ERROR, 400);
  }
  await prisma.event.delete({ where: { id: eventId } });
}

function uniqueSlug(base: string) {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${cleaned || "event"}-copy-${Date.now().toString(36)}`;
}

export async function copyEvent(eventId: string, organizerId: string) {
  const source = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      settings: true,
      intentTags: true,
      ticketTypes: true,
    },
  });
  if (!source) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const slug = uniqueSlug(source.slug);
  const draft = eventLifecycleFields("DRAFT");

  return prisma.$transaction(async (tx) => {
    const copied = await tx.event.create({
      data: {
        name: `${source.name}（副本）`,
        slug,
        type: source.type,
        activityType: source.activityType,
        ...draft,
        description: source.description,
        location: source.location,
        startDate: source.startDate,
        endDate: source.endDate,
        organizerId,
        orgId: source.orgId,
      },
    });

    if (source.settings.length > 0) {
      await tx.eventSetting.createMany({
        data: source.settings
          .filter((s) => s.value != null)
          .map((s) => ({
            eventId: copied.id,
            key: s.key,
            value: s.value as object,
          })),
      });
    }

    if (source.intentTags.length > 0) {
      await tx.intentTag.createMany({
        data: source.intentTags.map((t) => ({
          eventId: copied.id,
          label: t.label,
          slug: t.slug,
          category: t.category,
          color: t.color,
          sortOrder: t.sortOrder,
        })),
      });
    }

    if (source.ticketTypes.length > 0) {
      await tx.ticketType.createMany({
        data: source.ticketTypes.map((tt) => ({
          eventId: copied.id,
          name: tt.name,
          price: tt.price,
          quota: tt.quota,
        })),
      });
    }

    return copied;
  });
}
