import {
  AdminStatus,
  AccountType,
  InviteStatus,
  OrgStaffRole,
  prisma,
  UserType,
  type Prisma,
} from "@connectiq/database";
import bcrypt from "bcryptjs";
import { grantOrgAdminRoles } from "@/lib/org-admin-roles";
import { generateOrgSlug } from "@/lib/platform-application-service";
import { recordTrialSignal } from "@/lib/organizer-trial-service";
import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";

export class OrganizerSignupError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export type OrganizerSignupInput = {
  phone: string;
  code: string;
  companyName: string;
  contactName?: string;
  signupSource?: string;
};

export function organizerSignupLoginKey(token: string) {
  return `organizer-signup-login:${token}`;
}

const SIGNUP_LOGIN_TTL = 120;

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
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

async function verifySmsCode(phone: string, code: string) {
  const stored = await cacheGet(smsVerifyKey(phone));
  if (!stored || stored !== code) {
    throw new OrganizerSignupError("验证码错误或已过期", "INVALID_CODE");
  }
  await cacheDel(smsVerifyKey(phone));
}

async function assertCanSelfSignup(userId: string | null, phone: string) {
  const existingUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        include: {
          orgStaffRoles: {
            where: { status: InviteStatus.ACCEPTED },
            include: { org: { select: { adminStatus: true, name: true } } },
          },
        },
      })
    : await prisma.user.findFirst({
        where: { phone },
        include: {
          orgStaffRoles: {
            where: { status: InviteStatus.ACCEPTED },
            include: { org: { select: { adminStatus: true, name: true } } },
          },
        },
      });

  if (!existingUser) return null;

  const usableOrg = existingUser.orgStaffRoles.find((staff) =>
    ["APPROVED", "TRIAL"].includes(staff.org.adminStatus),
  );
  if (usableOrg) {
    throw new OrganizerSignupError(
      "该手机号已注册，请直接登录",
      "ALREADY_REGISTERED",
    );
  }

  const pendingApp = await prisma.organizerApplication.findFirst({
    where: {
      userId: existingUser.id,
      status: "PENDING",
    },
  });
  if (pendingApp) {
    throw new OrganizerSignupError(
      "该手机号已有审核中的正式申请，请等待审核或登录查看进度",
      "PENDING_APPLICATION",
    );
  }

  return existingUser;
}

export async function createOrganizerTrialSignup(input: OrganizerSignupInput) {
  const phone = input.phone.trim();
  const code = input.code.trim();
  const companyName = input.companyName.trim();
  const contactName = input.contactName?.trim() || `主办方${phone.slice(-4)}`;

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new OrganizerSignupError("请输入有效手机号", "INVALID_PHONE");
  }
  if (!companyName || companyName.length < 2) {
    throw new OrganizerSignupError("企业名称至少 2 个字符", "INVALID_COMPANY");
  }

  await verifySmsCode(phone, code);

  const existingUser = await assertCanSelfSignup(null, phone);
  const email = phoneToEmail(phone);

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
        data: {
          name: contactName,
          userType: UserType.ACCOUNT_ADMIN,
        },
      });
    }

    const slug = await resolveUniqueOrgSlug(tx, companyName);
    const org = await tx.organization.create({
      data: {
        name: companyName,
        slug,
        accountType: AccountType.ORGANIZATION,
        contactEmail: email,
        adminStatus: AdminStatus.TRIAL,
        ownerId: user.id,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { orgId: org.id },
    });

    await tx.orgStaff.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgStaffRole.OWNER,
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await grantOrgAdminRoles(tx, user.id);

    const trialProfile = await tx.organizerTrialProfile.create({
      data: {
        orgId: org.id,
        userId: user.id,
        companyName,
        contactName,
        signupSource: input.signupSource ?? "self_service_organizer",
      },
    });

    return { user, org, trialProfile };
  });

  await recordTrialSignal(result.org.id, "signup_completed", {
    phone,
    companyName,
  });

  const loginToken = crypto.randomUUID();
  await cacheSet(
    organizerSignupLoginKey(loginToken),
    result.user.id,
    SIGNUP_LOGIN_TTL,
  );

  return {
    userId: result.user.id,
    orgId: result.org.id,
    orgSlug: result.org.slug,
    orgName: result.org.name,
    phone: result.user.phone,
    adminStatus: AdminStatus.TRIAL,
    loginToken,
  };
}
