import bcrypt from "bcryptjs";
import {
  AccountType,
  ApplicationSource,
  ApplicationStatus,
  InviteStatus,
  OrgStaffRole,
  prisma,
  UserType,
} from "@connectiq/database";
import { sendApplicationConfirmationEmail } from "@/lib/email";
import { normalizeInvitePhone } from "@/lib/invite/phone";
import { cacheDel, cacheGet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";

const MINI_APPLY_EMAIL_DOMAIN = "mini-apply.9li.local";
const PLACEHOLDER_EMAIL_SUFFIXES = [
  "@phone.connectiq.local",
  "@mini.connectiq.local",
  `@${MINI_APPLY_EMAIL_DOMAIN}`,
] as const;

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

function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.toLowerCase();
  return PLACEHOLDER_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function miniApplyEmailFromPhone(phone: string) {
  return `${phone}@${MINI_APPLY_EMAIL_DOMAIN}`;
}

function buildMiniTrialDescription(input: {
  requirement?: string | null;
  wechat?: string | null;
}) {
  const parts: string[] = ["【小程序申请试用】"];
  const requirement = input.requirement?.trim();
  const wechat = input.wechat?.trim();
  if (requirement) parts.push(`活动规模/需求：${requirement}`);
  if (wechat) parts.push(`微信：${wechat}`);
  if (parts.length === 1) parts.push("未填写补充说明");
  return parts.join("\n");
}

/** User.email 唯一；冲突时抛可读错误，避免落到 500 INTERNAL_ERROR */
async function assertEmailAvailable(email: string, currentUserId?: string) {
  const normalized = email.toLowerCase();
  const owner = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (owner && owner.id !== currentUserId) {
    throw new ApplicationServiceError(
      "该邮箱已被其他账号使用，请更换邮箱或直接登录",
      "EMAIL_TAKEN",
    );
  }
  return normalized;
}

async function resolveApplicantUser(input: SubmitApplicationInput) {
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new ApplicationServiceError("用户不存在", "USER_NOT_FOUND");
    }

    const email = await assertEmailAvailable(input.email, user.id);

    if (user.email !== email) {
      return prisma.user.update({
        where: { id: user.id },
        data: { email, name: input.contactName },
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

  let user = await prisma.user.findFirst({ where: { phone: input.phone } });
  const email = await assertEmailAvailable(input.email, user?.id);

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
    source: ApplicationSource.SELF_REGISTER,
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

export type SubmitMiniTrialApplicationInput = {
  userId: string;
  contactName: string;
  orgName: string;
  contactPhone: string;
  wechat?: string | null;
  requirement?: string | null;
};

/**
 * 小程序「申请试用」→ 平台待审正式账号申请（OrganizerApplication PENDING）。
 * 无真实邮箱时用手机号派生占位邮箱，不发确认信。
 */
export async function submitMiniTrialApplication(
  input: SubmitMiniTrialApplicationInput,
) {
  const contactPhone = normalizeInvitePhone(input.contactPhone);
  if (!contactPhone) {
    throw new ApplicationServiceError(
      "请输入有效的中国大陆手机号",
      "VALIDATION_ERROR",
    );
  }

  const contactName = input.contactName.trim();
  if (contactName.length < 2) {
    throw new ApplicationServiceError("请输入联系人姓名", "VALIDATION_ERROR");
  }

  const orgName = normalizeOrgName(input.orgName);
  if (orgName.length < 2) {
    throw new ApplicationServiceError(
      "请输入组织/公司名称",
      "VALIDATION_ERROR",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      userType: true,
    },
  });
  if (!user) {
    throw new ApplicationServiceError("用户不存在", "USER_NOT_FOUND");
  }

  const boundPhone = user.phone ? normalizeInvitePhone(user.phone) : null;
  if (boundPhone && boundPhone !== contactPhone) {
    throw new ApplicationServiceError(
      "提交手机号与当前登录账号不一致，请重新授权手机号",
      "PHONE_MISMATCH",
    );
  }

  const contactEmail = !isPlaceholderEmail(user.email)
    ? user.email!.toLowerCase()
    : miniApplyEmailFromPhone(contactPhone);

  // 占位邮箱仅挂在申请记录上；不覆盖用户已有真实邮箱
  if (isPlaceholderEmail(user.email) && user.email !== contactEmail) {
    const taken = await prisma.user.findUnique({
      where: { email: contactEmail },
      select: { id: true },
    });
    if (!taken || taken.id === user.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: contactEmail,
          name: contactName,
          ...(boundPhone ? {} : { phone: contactPhone }),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: contactName,
          ...(boundPhone ? {} : { phone: contactPhone }),
        },
      });
    }
  } else if (user.name !== contactName || !boundPhone) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: contactName,
        ...(boundPhone ? {} : { phone: contactPhone }),
      },
    });
  }

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

  const description = buildMiniTrialDescription({
    requirement: input.requirement,
    wechat: input.wechat,
  });

  const payload = {
    accountType: AccountType.ORGANIZATION,
    orgName,
    orgCreditCode: null as string | null,
    orgWebsite: null as string | null,
    contactName,
    contactEmail,
    contactPhone,
    description,
    source: ApplicationSource.SELF_REGISTER,
    status: ApplicationStatus.PENDING,
    rejectionReason: null as string | null,
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

  // 标记为账号管理员（待审）；已是 ADMIN/平台管理员则不降级、不改写
  if (user.userType === UserType.END_USER) {
    await prisma.user.update({
      where: { id: user.id },
      data: { userType: UserType.ACCOUNT_ADMIN },
    });
  }

  if (!isPlaceholderEmail(contactEmail)) {
    try {
      await sendApplicationConfirmationEmail(contactEmail, orgName);
    } catch (err) {
      console.warn("[mini-trial-apply] confirmation email failed", err);
    }
  }

  return {
    application: formatApplicationRecord(application),
    userId: user.id,
    phone: contactPhone,
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
