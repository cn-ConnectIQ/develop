import {
  EventReviewStatus,
  EventStatus,
  prisma,
  ReviewStatus,
} from "@connectiq/database";
import { sendEventReviewNotificationEmail } from "@/lib/email";
import { sendNotificationSms } from "@/lib/sms";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";

const EVENT_TYPE_LABELS: Record<string, string> = {
  CONFERENCE: "会议",
  EXPO: "展会",
};

const REVIEW_STATUS_LABELS: Record<EventReviewStatus, string> = {
  PENDING_REVIEW: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  REVISION_REQUIRED: "需修改",
};

function accountTypeLabel(accountType: string | null | undefined) {
  if (!accountType) return ACCOUNT_TYPE_LABELS.ORGANIZATION;
  return (
    ACCOUNT_TYPE_LABELS[accountType as keyof typeof ACCOUNT_TYPE_LABELS] ??
    accountType
  );
}

export async function fetchPlatformEventReviews(params: {
  status?: EventReviewStatus | "ALL";
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const where = {
    ...(params.status && params.status !== "ALL"
      ? { status: params.status }
      : {}),
  };

  const [items, total, counts] = await Promise.all([
    prisma.eventReview.findMany({
      where,
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        event: {
          include: {
            org: {
              select: {
                id: true,
                name: true,
                isVerified: true,
                accountType: true,
              },
            },
            organizer: { select: { name: true, email: true, phone: true } },
          },
        },
        submitter: { select: { name: true, email: true } },
      },
    }),
    prisma.eventReview.count({ where }),
    prisma.eventReview.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of counts) {
    statusCounts[row.status] = row._count._all;
  }

  return {
    items: items.map((item) => ({
      id: item.id,
      eventId: item.eventId,
      status: item.status,
      statusLabel: REVIEW_STATUS_LABELS[item.status],
      submittedAt: item.submittedAt.toISOString(),
      rejectionReason: item.rejectionReason,
      revisionNotes: item.revisionNotes,
      reviewerNotes: item.reviewerNotes,
      event: {
        id: item.event.id,
        name: item.event.name,
        slug: item.event.slug,
        type: item.event.type,
        typeLabel: EVENT_TYPE_LABELS[item.event.type] ?? item.event.type,
        status: item.event.status,
        description: item.event.description,
        location: item.event.location,
        startDate: item.event.startDate?.toISOString() ?? null,
        endDate: item.event.endDate?.toISOString() ?? null,
        reviewStatus: item.event.reviewStatus,
        org: item.event.org
          ? {
              id: item.event.org.id,
              name: item.event.org.name,
              isVerified: item.event.org.isVerified,
              accountTypeLabel: accountTypeLabel(item.event.org.accountType),
            }
          : null,
        organizerName: item.event.organizer.name,
      },
      submitterName: item.submitter?.name ?? "—",
    })),
    total,
    page,
    pageSize,
    counts: statusCounts,
  };
}

export async function fetchPlatformEventReviewById(id: string) {
  const found = await prisma.eventReview.findUnique({
    where: { id },
    include: {
      event: {
        include: {
          org: {
            select: {
              id: true,
              name: true,
              isVerified: true,
              accountType: true,
            },
          },
          organizer: { select: { name: true, email: true, phone: true } },
        },
      },
      submitter: { select: { name: true, email: true } },
    },
  });
  if (!found) return null;

  return {
    id: found.id,
    eventId: found.eventId,
    status: found.status,
    statusLabel: REVIEW_STATUS_LABELS[found.status],
    submittedAt: found.submittedAt.toISOString(),
    rejectionReason: found.rejectionReason,
    revisionNotes: found.revisionNotes,
    reviewerNotes: found.reviewerNotes,
    event: {
      id: found.event.id,
      name: found.event.name,
      slug: found.event.slug,
      type: found.event.type,
      typeLabel: EVENT_TYPE_LABELS[found.event.type] ?? found.event.type,
      status: found.event.status,
      description: found.event.description,
      location: found.event.location,
      startDate: found.event.startDate?.toISOString() ?? null,
      endDate: found.event.endDate?.toISOString() ?? null,
      reviewStatus: found.event.reviewStatus,
      org: found.event.org
        ? {
            id: found.event.org.id,
            name: found.event.org.name,
            isVerified: found.event.org.isVerified,
            accountTypeLabel: accountTypeLabel(found.event.org.accountType),
          }
        : null,
      organizerName: found.event.organizer.name,
      organizerEmail: found.event.organizer.email,
      organizerPhone: found.event.organizer.phone,
    },
    submitterName: found.submitter?.name ?? "—",
  };
}

export async function reviewPlatformEvent(
  id: string,
  reviewerId: string,
  input: {
    status: "APPROVED" | "REJECTED" | "REVISION_REQUIRED";
    reviewerNotes?: string;
    feedback?: string;
  },
) {
  const review = await prisma.eventReview.findUnique({
    where: { id },
    include: {
      event: {
        include: {
          organizer: { select: { email: true, phone: true, name: true } },
        },
      },
    },
  });
  if (!review) throw new Error("REVIEW_NOT_FOUND");

  const reviewStatus = input.status as EventReviewStatus;
  const eventReviewStatus =
    input.status === "APPROVED"
      ? ReviewStatus.PUBLISHED
      : ReviewStatus.DRAFT;
  const eventStatus =
    input.status === "APPROVED" ? EventStatus.PUBLISHED : review.event.status;

  await prisma.$transaction([
    prisma.eventReview.update({
      where: { id },
      data: {
        status: reviewStatus,
        reviewerNotes: input.reviewerNotes ?? null,
        rejectionReason:
          input.status === "REJECTED" ? input.feedback ?? null : null,
        revisionNotes:
          input.status === "REVISION_REQUIRED" ? input.feedback ?? null : null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    }),
    prisma.event.update({
      where: { id: review.eventId },
      data: {
        reviewStatus: eventReviewStatus,
        ...(input.status === "APPROVED" ? { status: eventStatus } : {}),
      },
    }),
  ]);

  const organizer = review.event.organizer;
  let message = "";
  if (input.status === "APPROVED") {
    message = "您的活动已通过审核并公开发布。";
  } else if (input.status === "REVISION_REQUIRED") {
    message = `您的活动需要修改后重新提交。${input.feedback ? `\n\n${input.feedback}` : ""}`;
  } else {
    message = `您的活动未通过审核。${input.feedback ? `\n\n原因：${input.feedback}` : ""}`;
  }

  if (organizer.email) {
    await sendEventReviewNotificationEmail(
      organizer.email,
      review.event.name,
      message,
    );
  }
  if (organizer.phone) {
    await sendNotificationSms(organizer.phone, message.slice(0, 60));
  }

  return { status: input.status };
}

export { REVIEW_STATUS_LABELS, EVENT_TYPE_LABELS };
