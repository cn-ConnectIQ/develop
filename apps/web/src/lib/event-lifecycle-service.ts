import { EventReviewStatus, EventStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export async function archiveEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (event.status === EventStatus.ARCHIVED) {
    return event;
  }
  if (event.status === EventStatus.DRAFT) {
    throw new ApiError("草稿活动请直接删除", ErrorCode.VALIDATION_ERROR, 400);
  }
  return prisma.event.update({
    where: { id: eventId },
    data: { status: EventStatus.ARCHIVED },
  });
}

export async function deleteEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
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

  return prisma.$transaction(async (tx) => {
    const copied = await tx.event.create({
      data: {
        name: `${source.name}（副本）`,
        slug,
        type: source.type,
        activityType: source.activityType,
        status: EventStatus.DRAFT,
        reviewStatus: "DRAFT",
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
