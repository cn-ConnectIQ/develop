import bcrypt from "bcryptjs";
import {
  AccountType,
  ApplicationStatus,
  prisma,
  PrismaUserRole,
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
  accountType: AccountType;
  orgName: string;
  orgCreditCode?: string | null;
  orgWebsite?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
};

function accountTypeToRole(accountType: AccountType): PrismaUserRole {
  switch (accountType) {
    case AccountType.EXPO_ORGANIZER:
      return PrismaUserRole.EXPO_ORGANIZER;
    case AccountType.EXHIBITOR:
      return PrismaUserRole.EXHIBITOR;
    default:
      return PrismaUserRole.ORGANIZER;
  }
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

  const existing = await prisma.organizerApplication.findUnique({
    where: { userId: user.id },
  });

  if (existing?.status === ApplicationStatus.APPROVED) {
    throw new ApplicationServiceError("申请已通过审核", "ALREADY_APPROVED");
  }

  const payload = {
    accountType: input.accountType,
    orgName: input.orgName.trim(),
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

  const application = existing
    ? await prisma.organizerApplication.update({
        where: { id: existing.id },
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

  const legacyRole = accountTypeToRole(input.accountType);
  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { userId: user.id, role: legacyRole, entityId: null },
  });
  if (!assignment) {
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, role: legacyRole },
    });
  }

  await sendApplicationConfirmationEmail(
    input.contactEmail,
    input.orgName.trim(),
  );

  return {
    application: formatApplicationRecord(application),
    userId: user.id,
    phone: user.phone,
  };
}

export async function getOrganizerApplicationByUserId(userId: string) {
  const application = await prisma.organizerApplication.findUnique({
    where: { userId },
  });
  if (!application) return null;
  return formatApplicationRecord(application);
}
