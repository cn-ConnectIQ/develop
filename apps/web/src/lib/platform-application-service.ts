import {
  AccountType,
  AdminStatus,
  ApplicationStatus,
  InviteStatus,
  OrgStaffRole,
  prisma,
  UserType,
  type Prisma,
} from "@connectiq/database";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";
import {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
} from "@/lib/email";
import { sendNotificationSms } from "@/lib/sms";

export class PlatformApplicationError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "INVALID_STATUS" | "ALREADY_REVIEWED" | "USER_HAS_ORG",
  ) {
    super(message);
  }
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone || phone.length < 7) return phone ?? "—";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function maskCreditCode(code: string | null | undefined) {
  if (!code) return null;
  if (code.length <= 8) return code;
  return `${code.slice(0, 6)}****${code.slice(-2)}`;
}

/** 组织 slug 基础段（中文名取 unicode hex + 时间戳，英文直接规范化） */
export function generateOrgSlug(name: string): string {
  const trimmed = name.trim();
  const asciiSlug = trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

  if (asciiSlug.length >= 3) {
    return asciiSlug;
  }

  const code = trimmed
    .split("")
    .slice(0, 3)
    .map((c) => c.charCodeAt(0).toString(16).slice(-2))
    .join("");
  return `org-${code}-${Date.now().toString().slice(-4)}`;
}

async function resolveUniqueOrgSlug(
  tx: Prisma.TransactionClient,
  name: string,
): Promise<string> {
  const baseSlug = generateOrgSlug(name);
  let slug = baseSlug;
  let suffix = 1000;

  while (await tx.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return slug;
}

async function loadApplicationForReview(applicationId: string) {
  const application = await prisma.organizerApplication.findUnique({
    where: { id: applicationId },
    include: { user: true },
  });

  if (!application) {
    throw new PlatformApplicationError("申请不存在", "NOT_FOUND");
  }

  if (application.status !== ApplicationStatus.PENDING) {
    throw new PlatformApplicationError(
      "仅待审核的申请可操作",
      "ALREADY_REVIEWED",
    );
  }

  return application;
}

export async function approveApplication(
  applicationId: string,
  reviewerId: string,
  notes?: string,
) {
  const application = await loadApplicationForReview(applicationId);

  const existingOwnedOrg = await prisma.organization.findUnique({
    where: { ownerId: application.userId },
  });
  if (existingOwnedOrg) {
    throw new PlatformApplicationError(
      "该用户已拥有组织，无法重复创建",
      "USER_HAS_ORG",
    );
  }

  const { application: updated, org } = await prisma.$transaction(async (tx) => {
    const slug = await resolveUniqueOrgSlug(tx, application.orgName);

    const orgRecord = await tx.organization.create({
      data: {
        name: application.orgName,
        slug,
        accountType: application.accountType,
        orgCreditCode: application.orgCreditCode,
        website: application.orgWebsite,
        contactEmail: application.contactEmail,
        isVerified: true,
        adminStatus: AdminStatus.APPROVED,
        ownerId: application.userId,
      },
    });

    const updatedApplication = await tx.organizerApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.APPROVED,
        orgId: orgRecord.id,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewerNotes: notes?.trim() || null,
        rejectionReason: null,
      },
      include: { user: true },
    });

    await tx.user.update({
      where: { id: application.userId },
      data: {
        userType: UserType.ACCOUNT_ADMIN,
        orgId: orgRecord.id,
      },
    });

    await tx.orgStaff.create({
      data: {
        orgId: orgRecord.id,
        userId: application.userId,
        role: OrgStaffRole.OWNER,
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: application.userId,
        title: "🎉 账号申请已通过审核",
        body: `恭喜！你的账号已审核通过，组织「${orgRecord.name}」已创建。现在可以登录管理后台开始发布活动。`,
      },
    });

    return { application: updatedApplication, org: orgRecord };
  });

  await sendApplicationApprovedEmail(
    application.contactEmail,
    application.orgName,
  );
  if (application.contactPhone) {
    await sendNotificationSms(
      application.contactPhone,
      "审核通过，请登录 ConnectIQ 管理后台",
    );
  }

  return {
    status: ApplicationStatus.APPROVED,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    applicationId: updated.id,
    userId: updated.userId,
  };
}

export async function rejectApplication(
  applicationId: string,
  reviewerId: string,
  rejectionReason: string,
  notes?: string,
) {
  const application = await loadApplicationForReview(applicationId);
  const reason = rejectionReason.trim();

  if (!reason) {
    throw new PlatformApplicationError("请填写拒绝原因", "INVALID_STATUS");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedApplication = await tx.organizerApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        reviewerNotes: notes?.trim() || null,
      },
      include: { user: true },
    });

    await tx.notification.create({
      data: {
        userId: application.userId,
        title: "账号申请审核结果",
        body: `你的账号申请未通过审核。原因：${reason}。你可以修改申请信息后重新提交。`,
      },
    });

    return updatedApplication;
  });

  await sendApplicationRejectedEmail(
    application.contactEmail,
    application.orgName,
    reason,
  );
  if (application.contactPhone) {
    await sendNotificationSms(
      application.contactPhone,
      `审核未通过：${reason}`,
    );
  }

  return {
    status: ApplicationStatus.REJECTED,
    applicationId: updated.id,
    userId: updated.userId,
  };
}

export async function fetchPlatformApplications(params: {
  status?: ApplicationStatus | "ALL";
  accountType?: AccountType | "ALL";
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where = {
    ...(params.status && params.status !== "ALL"
      ? { status: params.status }
      : {}),
    ...(params.accountType && params.accountType !== "ALL"
      ? { accountType: params.accountType }
      : {}),
  };

  const [items, total, counts] = await Promise.all([
    prisma.organizerApplication.findMany({
      where,
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.organizerApplication.count({ where }),
    prisma.organizerApplication.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const statusCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  for (const row of counts) {
    if (row.status === ApplicationStatus.PENDING) {
      statusCounts.pending = row._count._all;
    } else if (row.status === ApplicationStatus.APPROVED) {
      statusCounts.approved = row._count._all;
    } else if (row.status === ApplicationStatus.REJECTED) {
      statusCounts.rejected = row._count._all;
    }
  }

  return {
    items: items.map((item) => ({
      id: item.id,
      status: item.status,
      accountType: item.accountType,
      accountTypeLabel: ACCOUNT_TYPE_LABELS[item.accountType],
      orgName: item.orgName,
      orgCreditCode: item.orgCreditCode,
      orgWebsite: item.orgWebsite,
      contactName: item.contactName,
      contactEmail: item.contactEmail,
      contactPhone: item.contactPhone,
      description: item.description,
      rejectionReason: item.rejectionReason,
      reviewerNotes: item.reviewerNotes,
      submittedAt: item.submittedAt.toISOString(),
      user: {
        id: item.user.id,
        name: item.user.name,
        phone: item.user.phone,
        email: item.user.email,
        createdAt: item.user.createdAt.toISOString(),
      },
    })),
    total,
    page,
    pageSize,
    counts: statusCounts,
  };
}

export async function fetchPlatformApplicationById(id: string) {
  const item = await prisma.organizerApplication.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          createdAt: true,
        },
      },
    },
  });
  if (!item) return null;

  return {
    id: item.id,
    status: item.status,
    accountType: item.accountType,
    accountTypeLabel: ACCOUNT_TYPE_LABELS[item.accountType],
    orgName: item.orgName,
    orgCreditCode: item.orgCreditCode,
    orgWebsite: item.orgWebsite,
    contactName: item.contactName,
    contactEmail: item.contactEmail,
    contactPhone: item.contactPhone,
    description: item.description,
    rejectionReason: item.rejectionReason,
    reviewerNotes: item.reviewerNotes,
    submittedAt: item.submittedAt.toISOString(),
    user: {
      id: item.user.id,
      name: item.user.name,
      phone: item.user.phone,
      email: item.user.email,
      createdAt: item.user.createdAt.toISOString(),
    },
  };
}

export async function reviewPlatformApplication(
  id: string,
  reviewerId: string,
  input: {
    status: "APPROVED" | "REJECTED" | "REVISION_REQUIRED";
    reviewerNotes?: string;
    rejectionReason?: string;
  },
) {
  if (input.status === "APPROVED") {
    return approveApplication(id, reviewerId, input.reviewerNotes);
  }

  const reason =
    input.rejectionReason?.trim() ||
    (input.status === "REVISION_REQUIRED"
      ? "请补充申请资料后重新提交"
      : "未满足平台审核要求");

  return rejectApplication(id, reviewerId, reason, input.reviewerNotes);
}
