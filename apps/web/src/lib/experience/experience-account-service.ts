import {
  AccountType,
  AdminStatus,
  ApplicationSource,
  ApplicationStatus,
  ExperienceAccountRole,
  ExperienceAccountStatus,
  InviteChannel,
  InviteStatus,
  OrgStaffRole,
  ParticipantInviteStatus,
  ParticipantSource,
  SystemRole,
  UserType,
  prisma,
  type Prisma,
} from "@connectiq/database";
import bcrypt from "bcryptjs";
import { grantOrgAdminRoles } from "@/lib/org-admin-roles";
import { approveApplication } from "@/lib/platform-application-service";
import { generateBadgeQr } from "@/lib/participants";
import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";
import {
  EXPERIENCE_DEMO_EVENT_SLUG,
  EXPERIENCE_DEMO_ORG_SLUG,
  EXPERIENCE_MAX_COLLEAGUES,
  EXPERIENCE_TRIAL_DAYS,
} from "@/lib/experience/experience-config";
import { isPrismaSchemaDriftError } from "@/lib/prisma-errors";

export class ExperienceAccountError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export function experienceSignupLoginKey(token: string) {
  return `experience-signup-login:${token}`;
}

const SIGNUP_LOGIN_TTL = 120;

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function verifySmsCode(phone: string, code: string) {
  const stored = await cacheGet(smsVerifyKey(phone));
  if (!stored || stored !== code) {
    throw new ExperienceAccountError("验证码错误或已过期", "INVALID_CODE");
  }
  await cacheDel(smsVerifyKey(phone));
}

async function resolveDemoContext() {
  const org = await prisma.organization.findUnique({
    where: { slug: EXPERIENCE_DEMO_ORG_SLUG },
    select: { id: true, name: true, adminStatus: true },
  });
  const event = await prisma.event.findUnique({
    where: { slug: EXPERIENCE_DEMO_EVENT_SLUG },
    select: { id: true, name: true, orgId: true },
  });

  if (!org || !event || event.orgId !== org.id) {
    throw new ExperienceAccountError(
      "演示展会环境未就绪，请联系管理员",
      "DEMO_NOT_READY",
    );
  }

  return { org, event };
}

export async function getExperienceAccountByUserId(userId: string) {
  try {
    return await prisma.experienceAccount.findUnique({
      where: { userId },
      include: {
        org: { select: { id: true, name: true, slug: true, adminStatus: true } },
        event: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function refreshExperienceAccountStatus(
  record: { id: string; status: ExperienceAccountStatus; expiresAt: Date },
) {
  if (
    record.status === ExperienceAccountStatus.ACTIVE &&
    record.expiresAt.getTime() < Date.now()
  ) {
    return prisma.experienceAccount.update({
      where: { id: record.id },
      data: { status: ExperienceAccountStatus.EXPIRED },
    });
  }
  return null;
}

export async function getActiveExperienceAccount(userId: string) {
  const record = await getExperienceAccountByUserId(userId);
  if (!record) return null;

  const refreshed = await refreshExperienceAccountStatus(record);
  if (refreshed) return refreshed;

  if (record.status !== ExperienceAccountStatus.ACTIVE) return record;
  if (record.expiresAt.getTime() < Date.now()) {
    return prisma.experienceAccount.update({
      where: { id: record.id },
      data: { status: ExperienceAccountStatus.EXPIRED },
    });
  }
  return record;
}

export async function syncExpiredExperienceAccounts() {
  const result = await prisma.experienceAccount.updateMany({
    where: {
      status: ExperienceAccountStatus.ACTIVE,
      expiresAt: { lt: new Date() },
    },
    data: { status: ExperienceAccountStatus.EXPIRED },
  });
  return result.count;
}

export async function isActiveExperienceUser(userId: string) {
  const record = await getActiveExperienceAccount(userId);
  return record?.status === ExperienceAccountStatus.ACTIVE;
}

async function assertCanCreateExperience(phone: string) {
  const existingUser = await prisma.user.findFirst({
    where: { phone },
    include: {
      experienceAccount: true,
      orgStaffRoles: {
        where: { status: InviteStatus.ACCEPTED },
        include: { org: { select: { adminStatus: true, slug: true } } },
      },
    },
  });

  if (!existingUser) return null;

  if (existingUser.experienceAccount) {
    if (existingUser.experienceAccount.status === ExperienceAccountStatus.ACTIVE) {
      throw new ExperienceAccountError("该手机号已有进行中的体验账号，请直接登录", "ALREADY_ACTIVE");
    }
    if (existingUser.experienceAccount.status === ExperienceAccountStatus.CONVERTED) {
      throw new ExperienceAccountError("该手机号已转为正式账号，请直接登录", "ALREADY_CONVERTED");
    }
  }

  const formalOrg = existingUser.orgStaffRoles.find(
    (staff) =>
      staff.org.adminStatus === AdminStatus.APPROVED &&
      staff.org.slug !== EXPERIENCE_DEMO_ORG_SLUG &&
      (staff.role === OrgStaffRole.OWNER ||
        staff.role === OrgStaffRole.ADMIN),
  );
  if (formalOrg) {
    throw new ExperienceAccountError("该手机号已是正式账号管理员，请直接登录", "ALREADY_FORMAL");
  }

  const pendingApp = await prisma.organizerApplication.findFirst({
    where: {
      userId: existingUser.id,
      status: ApplicationStatus.PENDING,
      // Demo 潜客待审不阻断重新进入体验；正式自助申请仍需等待
      NOT: { source: ApplicationSource.EXPERIENCE_DEMO },
    },
  });
  if (pendingApp) {
    throw new ExperienceAccountError(
      "该手机号已有审核中的正式申请，请等待审核",
      "PENDING_APPLICATION",
    );
  }

  return existingUser;
}

async function upsertExperienceProspectApplication(
  tx: Pick<Prisma.TransactionClient, "organizerApplication">,
  input: {
    userId: string;
    experienceAccountId: string;
    contactName: string;
    companyName: string | null;
    phone: string;
    email: string;
  },
) {
  const orgName = input.companyName || `${input.contactName}的组织`;
  const description =
    "Demo 展会工作人员体验注册（潜客）。审核通过后解锁创建活动与付费能力。";

  const existing =
    (await tx.organizerApplication.findUnique({
      where: { experienceAccountId: input.experienceAccountId },
    })) ??
    (await tx.organizerApplication.findFirst({
      where: {
        userId: input.userId,
        source: ApplicationSource.EXPERIENCE_DEMO,
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.REJECTED],
        },
      },
      orderBy: { submittedAt: "desc" },
    }));

  const payload = {
    accountType: AccountType.ORGANIZATION,
    orgName,
    orgCreditCode: null as string | null,
    orgWebsite: null as string | null,
    contactName: input.contactName,
    contactEmail: input.email,
    contactPhone: input.phone,
    description,
    source: ApplicationSource.EXPERIENCE_DEMO,
    experienceAccountId: input.experienceAccountId,
    status: ApplicationStatus.PENDING,
    rejectionReason: null as string | null,
    submittedAt: new Date(),
  };

  if (existing) {
    return tx.organizerApplication.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return tx.organizerApplication.create({
    data: {
      userId: input.userId,
      ...payload,
    },
  });
}

async function ensureParticipantForExperience(
  tx: Prisma.TransactionClient,
  input: {
    eventId: string;
    userId: string;
    phone: string;
    email: string;
    name: string;
    companyName?: string | null;
  },
) {
  const existing = await tx.participant.findFirst({
    where: { eventId: input.eventId, phone: input.phone },
  });
  if (existing) {
    const participant = await tx.participant.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        email: input.email,
        company: input.companyName ?? existing.company,
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
        systemRole: SystemRole.ORGANIZER_STAFF,
      },
    });
    await tx.checkIn.upsert({
      where: {
        eventId_participantId: {
          eventId: input.eventId,
          participantId: participant.id,
        },
      },
      create: {
        eventId: input.eventId,
        participantId: participant.id,
        method: "experience_signup",
      },
      update: {},
    });
    return participant;
  }

  const participant = await tx.participant.create({
    data: {
      eventId: input.eventId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      company: input.companyName ?? null,
      badgeQr: generateBadgeQr(input.eventId),
      systemRole: SystemRole.ORGANIZER_STAFF,
      source: ParticipantSource.SELF_REGISTER,
      inviteStatus: ParticipantInviteStatus.ACTIVATED,
    },
  });

  await tx.checkIn.create({
    data: {
      eventId: input.eventId,
      participantId: participant.id,
      method: "experience_signup",
    },
  });

  await tx.userEventCode.upsert({
    where: {
      eventId_userId: { eventId: input.eventId, userId: input.userId },
    },
    create: { eventId: input.eventId, userId: input.userId },
    update: {},
  });

  return participant;
}

async function provisionExperienceStaff(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    userId: string;
    role: ExperienceAccountRole;
  },
) {
  const staffRole =
    input.role === ExperienceAccountRole.PRIMARY
      ? OrgStaffRole.OPERATOR
      : OrgStaffRole.OPERATOR;

  return tx.orgStaff.upsert({
    where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
    create: {
      orgId: input.orgId,
      userId: input.userId,
      role: staffRole,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
    update: {
      role: staffRole,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });
}

export type CreateExperienceSignupInput = {
  phone: string;
  code: string;
  contactName?: string;
  companyName?: string;
};

export async function createExperienceSignup(input: CreateExperienceSignupInput) {
  const phone = input.phone.trim();
  const code = input.code.trim();
  const contactName = input.contactName?.trim() || `体验用户${phone.slice(-4)}`;
  const companyName = input.companyName?.trim() || null;

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new ExperienceAccountError("请输入有效手机号", "INVALID_PHONE");
  }

  await verifySmsCode(phone, code);
  const { org, event } = await resolveDemoContext();
  const existingUser = await assertCanCreateExperience(phone);
  const email = phoneToEmail(phone);
  const expiresAt = addDays(new Date(), EXPERIENCE_TRIAL_DAYS);

  const result = await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          phone,
          email,
          passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
          name: contactName,
          userType: UserType.ACCOUNT_ADMIN,
        },
      }));

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { name: contactName, userType: UserType.ACCOUNT_ADMIN },
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: { orgId: org.id },
    });

    const orgStaff = await provisionExperienceStaff(tx, {
      orgId: org.id,
      userId: user.id,
      role: ExperienceAccountRole.PRIMARY,
    });

    await grantOrgAdminRoles(tx, user.id);

    const participant = await ensureParticipantForExperience(tx, {
      eventId: event.id,
      userId: user.id,
      phone,
      email,
      name: contactName,
      companyName,
    });

    const experienceAccount = await tx.experienceAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        orgId: org.id,
        eventId: event.id,
        orgStaffId: orgStaff.id,
        participantId: participant.id,
        role: ExperienceAccountRole.PRIMARY,
        status: ExperienceAccountStatus.ACTIVE,
        expiresAt,
        contactName,
        companyName,
        phone,
      },
      update: {
        orgId: org.id,
        eventId: event.id,
        orgStaffId: orgStaff.id,
        participantId: participant.id,
        role: ExperienceAccountRole.PRIMARY,
        status: ExperienceAccountStatus.ACTIVE,
        expiresAt,
        contactName,
        companyName,
        phone,
        convertedAt: null,
        convertedByUserId: null,
        convertedOrgId: null,
      },
    });

    // 主账号进入潜客池：创建/刷新待审正式申请（与直接注册同审）
    const application = await upsertExperienceProspectApplication(tx, {
      userId: user.id,
      experienceAccountId: experienceAccount.id,
      contactName,
      companyName,
      phone,
      email,
    });

    return { user, experienceAccount, application, event };
  });

  const loginToken = crypto.randomUUID();
  await cacheSet(
    experienceSignupLoginKey(loginToken),
    result.user.id,
    SIGNUP_LOGIN_TTL,
  );

  return {
    userId: result.user.id,
    experienceAccountId: result.experienceAccount.id,
    applicationId: result.application.id,
    eventId: result.event.id,
    eventName: result.event.name,
    expiresAt: result.experienceAccount.expiresAt.toISOString(),
    loginToken,
  };
}

export async function inviteExperienceColleague(
  inviterUserId: string,
  input: { phone: string; contactName?: string },
) {
  const phone = input.phone.trim();
  const contactName = input.contactName?.trim() || `同事${phone.slice(-4)}`;

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new ExperienceAccountError("请输入有效手机号", "INVALID_PHONE");
  }

  const inviter = await getActiveExperienceAccount(inviterUserId);
  if (!inviter || inviter.role !== ExperienceAccountRole.PRIMARY) {
    throw new ExperienceAccountError("仅体验主账号可邀请同事", "NOT_PRIMARY");
  }

  const colleagueCount = await prisma.experienceAccount.count({
    where: {
      invitedByUserId: inviterUserId,
      status: ExperienceAccountStatus.ACTIVE,
    },
  });
  if (colleagueCount >= EXPERIENCE_MAX_COLLEAGUES) {
    throw new ExperienceAccountError(
      `最多邀请 ${EXPERIENCE_MAX_COLLEAGUES} 位同事`,
      "COLLEAGUE_LIMIT",
    );
  }

  const { org, event } = await resolveDemoContext();
  const email = phoneToEmail(phone);
  const expiresAt = inviter.expiresAt;

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findFirst({ where: { phone } });
    if (!user) {
      user = await tx.user.create({
        data: {
          phone,
          email,
          passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
          name: contactName,
          userType: UserType.ACCOUNT_ADMIN,
          orgId: org.id,
        },
      });
    } else {
      await tx.user.update({
        where: { id: user.id },
        data: { name: contactName, userType: UserType.ACCOUNT_ADMIN, orgId: org.id },
      });
    }

    const orgStaff = await provisionExperienceStaff(tx, {
      orgId: org.id,
      userId: user.id,
      role: ExperienceAccountRole.COLLEAGUE,
    });

    await grantOrgAdminRoles(tx, user.id);

    const participant = await ensureParticipantForExperience(tx, {
      eventId: event.id,
      userId: user.id,
      phone,
      email,
      name: contactName,
      companyName: inviter.companyName,
    });

    const experienceAccount = await tx.experienceAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        orgId: org.id,
        eventId: event.id,
        orgStaffId: orgStaff.id,
        participantId: participant.id,
        role: ExperienceAccountRole.COLLEAGUE,
        invitedByUserId: inviterUserId,
        status: ExperienceAccountStatus.ACTIVE,
        expiresAt,
        contactName,
        companyName: inviter.companyName,
        phone,
      },
      update: {
        orgId: org.id,
        eventId: event.id,
        orgStaffId: orgStaff.id,
        participantId: participant.id,
        role: ExperienceAccountRole.COLLEAGUE,
        invitedByUserId: inviterUserId,
        status: ExperienceAccountStatus.ACTIVE,
        expiresAt,
        contactName,
        companyName: inviter.companyName,
        phone,
      },
    });

    return experienceAccount;
  });

  return {
    experienceAccountId: result.id,
    phone,
    contactName,
    expiresAt: result.expiresAt.toISOString(),
  };
}

export async function fetchPlatformExperienceAccounts(input: {
  status?: ExperienceAccountStatus | "ALL";
  page?: number;
  pageSize?: number;
}) {
  await syncExpiredExperienceAccounts();

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const where =
    input.status && input.status !== "ALL"
      ? { status: input.status }
      : undefined;

  const [items, total, activeCount, expiredCount, convertedCount] =
    await Promise.all([
      prisma.experienceAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          org: { select: { id: true, name: true, slug: true } },
          event: { select: { id: true, name: true, slug: true } },
          inviter: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.experienceAccount.count({ where }),
      prisma.experienceAccount.count({
        where: { status: ExperienceAccountStatus.ACTIVE },
      }),
      prisma.experienceAccount.count({
        where: { status: ExperienceAccountStatus.EXPIRED },
      }),
      prisma.experienceAccount.count({
        where: { status: ExperienceAccountStatus.CONVERTED },
      }),
    ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      user: item.user,
      org: item.org,
      event: item.event,
      inviter: item.inviter,
      role: item.role,
      status: item.status,
      phone: item.phone,
      contactName: item.contactName,
      companyName: item.companyName,
      startedAt: item.startedAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
      extendedCount: item.extendedCount,
      lastExtendedAt: item.lastExtendedAt?.toISOString() ?? null,
      convertedAt: item.convertedAt?.toISOString() ?? null,
      convertedOrgId: item.convertedOrgId,
      platformNotes: item.platformNotes,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    counts: { active: activeCount, expired: expiredCount, converted: convertedCount },
  };
}

export async function extendExperienceAccount(
  experienceAccountId: string,
  reviewerId: string,
  days: number,
  notes?: string,
) {
  const record = await prisma.experienceAccount.findUnique({
    where: { id: experienceAccountId },
  });
  if (!record) {
    throw new ExperienceAccountError("体验账号不存在", "NOT_FOUND");
  }
  if (
    record.status !== ExperienceAccountStatus.ACTIVE &&
    record.status !== ExperienceAccountStatus.EXPIRED
  ) {
    throw new ExperienceAccountError("当前状态不可延期", "INVALID_STATUS");
  }

  const base =
    record.status === ExperienceAccountStatus.EXPIRED
      ? new Date()
      : record.expiresAt;
  const expiresAt = addDays(base, days);

  await prisma.experienceAccount.updateMany({
    where: {
      OR: [{ id: experienceAccountId }, { invitedByUserId: record.userId }],
      status: { in: [ExperienceAccountStatus.ACTIVE, ExperienceAccountStatus.EXPIRED] },
    },
    data: {
      status: ExperienceAccountStatus.ACTIVE,
      expiresAt,
    },
  });

  return prisma.experienceAccount.update({
    where: { id: experienceAccountId },
    data: {
      status: ExperienceAccountStatus.ACTIVE,
      expiresAt,
      extendedCount: { increment: 1 },
      lastExtendedAt: new Date(),
      lastExtendedByUserId: reviewerId,
      platformNotes: notes?.trim() || record.platformNotes,
    },
  });
}

/**
 * 体验转正：收敛到组织申请「审核通过」同一出口（创建正式组织 + 邮件/短信通知）。
 * 不再绕过审核直建组织。
 */
export async function convertExperienceAccountToFormal(
  experienceAccountId: string,
  reviewerId: string,
  input: { orgName: string; notes?: string },
) {
  const orgName = input.orgName.trim();
  if (orgName.length < 2) {
    throw new ExperienceAccountError("组织名称至少 2 个字符", "INVALID_ORG");
  }

  const record = await prisma.experienceAccount.findUnique({
    where: { id: experienceAccountId },
    include: {
      user: true,
      application: true,
    },
  });
  if (!record) {
    throw new ExperienceAccountError("体验账号不存在", "NOT_FOUND");
  }
  if (record.status === ExperienceAccountStatus.CONVERTED) {
    throw new ExperienceAccountError("该体验账号已转为正式账号", "ALREADY_CONVERTED");
  }

  let application =
    record.application ??
    (await prisma.organizerApplication.findFirst({
      where: {
        userId: record.userId,
        source: ApplicationSource.EXPERIENCE_DEMO,
        status: ApplicationStatus.PENDING,
      },
      orderBy: { submittedAt: "desc" },
    }));

  if (!application) {
    application = await upsertExperienceProspectApplication(prisma, {
      userId: record.userId,
      experienceAccountId: record.id,
      contactName: record.contactName || record.user.name,
      companyName: orgName,
      phone: record.phone,
      email: record.user.email,
    });
  } else if (application.status !== ApplicationStatus.PENDING) {
    throw new ExperienceAccountError(
      "关联申请不在待审状态，请在「组织申请」中处理",
      "INVALID_APPLICATION",
    );
  } else {
    application = await prisma.organizerApplication.update({
      where: { id: application.id },
      data: {
        orgName,
        experienceAccountId: record.id,
        source: ApplicationSource.EXPERIENCE_DEMO,
      },
    });
  }

  const approved = await approveApplication(
    application.id,
    reviewerId,
    input.notes,
  );

  return {
    orgId: approved.orgId,
    orgName: approved.orgName,
    orgSlug: approved.orgSlug,
    experienceAccountId: record.id,
    applicationId: approved.applicationId,
  };
}

export async function assertExperienceCanSendInvite(
  userId: string,
  channel: InviteChannel,
) {
  if (!(await isActiveExperienceUser(userId))) return;
  if (
    channel === InviteChannel.EMAIL ||
    channel === InviteChannel.SMS ||
    channel === InviteChannel.WECHAT
  ) {
    throw new ExperienceAccountError(
      "体验账号不支持批量邮件/短信/微信邀请，请升级正式账号",
      "INVITE_BLOCKED",
    );
  }
}

export async function assertExperienceCanManageMeetings(userId: string) {
  if (!(await isActiveExperienceUser(userId))) return;
  throw new ExperienceAccountError(
    "体验账号不能发布或开启商务会面，请升级正式账号",
    "MEETING_BLOCKED",
  );
}

export async function assertExperienceCanPublishEvent(userId: string) {
  if (!(await isActiveExperienceUser(userId))) return;
  throw new ExperienceAccountError(
    "体验账号不能发布活动，请升级正式账号",
    "PUBLISH_BLOCKED",
  );
}

export async function assertExperienceCanCreateEvent(userId: string) {
  if (!(await isActiveExperienceUser(userId))) return;
  throw new ExperienceAccountError(
    "体验账号不能创建新活动，请升级正式账号",
    "CREATE_EVENT_BLOCKED",
  );
}
