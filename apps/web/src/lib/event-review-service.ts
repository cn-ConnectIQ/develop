import {
  prisma,
  PrismaUserRole,
  ReviewStatus,
  UserType,
} from "@connectiq/database";

export class EventReviewError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export function validateEventForReview(event: {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  description: string | null;
}) {
  if (!event.name?.trim()) return "活动名称不能为空";
  if (!event.startDate) return "开始时间不能为空";
  if (!event.endDate) return "结束时间不能为空";
  if (!event.location?.trim()) return "地点不能为空";
  if (!event.description?.trim()) return "活动描述不能为空";
  return null;
}

async function notifyPlatformAdmins(eventName: string, eventId: string) {
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { userType: UserType.PLATFORM_ADMIN },
        {
          roleAssignments: {
            some: { role: PrismaUserRole.PLATFORM_ADMIN },
          },
        },
      ],
    },
    select: { id: true },
  });

  const uniqueIds = [...new Set(admins.map((a) => a.id))];
  if (uniqueIds.length === 0) return;

  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({
      userId,
      title: "[系统] 新活动待审核",
      body: `活动「${eventName}」已提交发布审核，请前往平台审核中心处理。活动 ID：${eventId}`,
    })),
  });
}

export async function submitEventForReview(
  eventId: string,
  submitterId: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { review: true },
  });

  if (!event) {
    throw new EventReviewError("活动不存在", "NOT_FOUND");
  }

  if (event.reviewStatus === ReviewStatus.PENDING_REVIEW) {
    throw new EventReviewError("活动已在审核中", "ALREADY_PENDING");
  }

  if (event.reviewStatus === ReviewStatus.APPROVED) {
    throw new EventReviewError("活动已通过审核", "ALREADY_APPROVED");
  }

  const validationError = validateEventForReview(event);
  if (validationError) {
    throw new EventReviewError(validationError, "VALIDATION_ERROR");
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventReview.upsert({
      where: { eventId },
      create: {
        eventId,
        submittedBy: submitterId,
        status: ReviewStatus.PENDING_REVIEW,
        submittedAt: new Date(),
      },
      update: {
        status: ReviewStatus.PENDING_REVIEW,
        submittedBy: submitterId,
        submittedAt: new Date(),
        rejectionReason: null,
        revisionNotes: null,
        reviewerNotes: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    await tx.event.update({
      where: { id: eventId },
      data: { reviewStatus: ReviewStatus.PENDING_REVIEW },
    });
  });

  await notifyPlatformAdmins(event.name, eventId);

  return { reviewStatus: ReviewStatus.PENDING_REVIEW };
}

export async function cancelEventReview(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { review: true },
  });

  if (!event) {
    throw new EventReviewError("活动不存在", "NOT_FOUND");
  }

  if (event.reviewStatus !== ReviewStatus.PENDING_REVIEW) {
    throw new EventReviewError("仅审核中的活动可取消申请", "INVALID_STATUS");
  }

  await prisma.$transaction(async (tx) => {
    if (event.review) {
      await tx.eventReview.update({
        where: { eventId },
        data: { status: ReviewStatus.DRAFT },
      });
    }
    await tx.event.update({
      where: { id: eventId },
      data: { reviewStatus: ReviewStatus.DRAFT },
    });
  });

  return { reviewStatus: ReviewStatus.DRAFT };
}

export function isEventLockedForReview(reviewStatus: string | null | undefined) {
  return reviewStatus === ReviewStatus.PENDING_REVIEW;
}
