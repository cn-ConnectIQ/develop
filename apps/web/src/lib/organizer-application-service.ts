import bcrypt from "bcryptjs";
import {
  AccountType,
  ApplicationStatus,
  InviteStatus,
  OrgStaffRole,
  prisma,
  UserType,
} from "@connectiq/database";
import { sendApplicationConfirmationEmail } from "@/lib/email";
import { cacheDel, cacheGet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";

export class ApplicationServiceError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export type SubmitApplicationInput = {
  userId?: string;
  phone?: string;
  code?: string;
  email: string;
  orgName: string;
  orgCreditCode?: string | null;
  orgWebsite?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
};

function normalizeOrgName(name: string) {
  return name.trim();
}

async function resolveApplicantUser(input: SubmitApplicationInput) {
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new ApplicationServiceError("用户不存在", "USER_NOT_FOUND");
    }

    if (user.email !== input.email.toLowerCase()) {
      return prisma.user.update({
        where: { id: user.id },
        data: { email: input.email.toLowerCase(), name: input.contactName },
      });
    }

    if (user.name !== input.contactName) {
      return prisma.user.update({
        where: { id: user.id },
        data: { name: input.contactName },
      });
    }

    return user;
  }

  if (!input.phone || !input.code) {
    throw new ApplicationServiceError("请先验证手机号", "PHONE_REQUIRED");
  }

  const stored = await cacheGet(smsVerifyKey(input.phone));
  if (!stored || stored !== input.code) {
    throw new ApplicationServiceError("验证码错误或已过期", "INVALID_CODE");
  }
  await cacheDel(smsVerifyKey(input.phone));

  const email = input.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { phone: input.phone } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: input.phone,
        email,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
        name: input.contactName,
        userType: UserType.END_USER,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email, name: input.contactName },
    });
  }

  return user;
}

export function formatApplicationRecord(application: {
  id: string;
  status: ApplicationStatus;
  accountType: AccountType;
  orgName: string;
  orgCreditCode: string | null;
  orgWebsite: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  rejectionReason: string | null;
  submittedAt: Date;
}) {
  return {
    id: application.id,
    status: application.status,
    accountType: application.accountType,
    accountTypeLabel: ACCOUNT_TYPE_LABELS[application.accountType],
    orgName: application.orgName,
    orgCreditCode: application.orgCreditCode,
    orgWebsite: application.orgWebsite,
    contactName: application.contactName,
    contactEmail: application.contactEmail,
    contactPhone: application.contactPhone,
    description: application.description,
    rejectionReason: application.rejectionReason,
    submittedAt: application.submittedAt.toISOString(),
  };
}

export async function submitOrganizerApplication(input: SubmitApplicationInput) {
  const user = await resolveApplicantUser(input);
  const orgName = normalizeOrgName(input.orgName);

  const existingPendingOrApproved =
    await prisma.organizerApplication.findFirst({
      where: {
        userId: user.id,
        orgName,
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
        },
      },
    });

  if (existingPendingOrApproved) {
    const statusText =
      existingPendingOrApproved.status === ApplicationStatus.PENDING
        ? "你已提交该组织的申请，正在审核中"
        : "你已拥有该组织，无需重复申请";
    throw new ApplicationServiceError(statusText, "DUPLICATE_APPLICATION");
  }

  const ownedOrg = await prisma.orgStaff.findFirst({
    where: {
      userId: user.id,
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      org: { name: orgName },
    },
    select: { orgId: true },
  });
  if (ownedOrg) {
    throw new ApplicationServiceError(
      "你已拥有该组织，无需重复申请",
      "DUPLICATE_APPLICATION",
    );
  }

  const payload = {
    accountType: AccountType.ORGANIZATION,
    orgName,
    orgCreditCode: input.orgCreditCode?.trim() || null,
    orgWebsite: input.orgWebsite?.trim() || null,
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    contactPhone: input.contactPhone.trim(),
    description: input.description.trim(),
    status: ApplicationStatus.PENDING,
    rejectionReason: null,
    submittedAt: new Date(),
  };

  const existingRejected = await prisma.organizerApplication.findFirst({
    where: {
      userId: user.id,
      orgName,
      status: ApplicationStatus.REJECTED,
    },
  });

  const application = existingRejected
    ? await prisma.organizerApplication.update({
        where: { id: existingRejected.id },
        data: payload,
      })
    : await prisma.organizerApplication.create({
        data: {
          userId: user.id,
          ...payload,
        },
      });

  await prisma.user.update({
    where: { id: user.id },
    data: { userType: UserType.ACCOUNT_ADMIN },
  });

  await sendApplicationConfirmationEmail(
    input.contactEmail,
    orgName,
  );

  return {
    application: formatApplicationRecord(application),
    userId: user.id,
    phone: user.phone,
  };
}

export async function getOrganizerApplicationsByUserId(userId: string) {
  const applications = await prisma.organizerApplication.findMany({
    where: { userId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          accountType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications.map((application) => ({
    ...formatApplicationRecord(application),
    org: application.org
      ? {
          id: application.org.id,
          name: application.org.name,
          slug: application.org.slug,
          accountType: application.org.accountType,
        }
      : null,
  }));
}

/** @deprecated 使用 getOrganizerApplicationsByUserId */
export async function getOrganizerApplicationByUserId(userId: string) {
  const applications = await getOrganizerApplicationsByUserId(userId);
  return applications[0] ?? null;
}
