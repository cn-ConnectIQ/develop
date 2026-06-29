import { createHash, randomUUID } from "crypto";
import {
  AccountType,
  InviteStatus,
  RegistrationSource,
  UserAccountStatus,
  UserType as PrismaUserType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getOrCreateContactCard } from "@/lib/contact-card-service";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import { cacheDel, cacheGet } from "@/lib/redis";
import { smsVerifyKey } from "@/lib/sms";
import { code2Session } from "@/lib/wechat/auth";
import { getWxMiniCredentials } from "@/lib/wechat/config";
import { getWechatAccessToken } from "@/lib/wechat/access-token";

/** 与 packages/database/prisma/seed-mobile-test-attendee.ts 保持一致 */
export const MINI_DEV_TEST_PHONE = "13770626459";
export const MINI_DEV_TEST_SMS_CODE = "888888";

export type MiniLoginUserPayload = {
  id: string;
  name: string;
  avatar: string | null;
  company: string | null;
  title: string | null;
  userType: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
  hasProfile: boolean;
  hasWechatQr: boolean;
  /** 小程序身份切换：ORGANIZER / EXHIBITOR / ATTENDEE */
  role?: "ORGANIZER" | "EXHIBITOR" | "ATTENDEE";
  staff_role?: "BOOTH";
};

export type MiniWxLoginResult = {
  token: string;
  user: MiniLoginUserPayload;
};

const userSelect = {
  id: true,
  name: true,
  phone: true,
  userType: true,
  orgId: true,
  profile: {
    select: {
      company: true,
      valueProposition: true,
      accountStatus: true,
    },
  },
} as const;

type DbUser = NonNullable<Awaited<ReturnType<typeof findUserByWechatOpenId>>>;

function mapUserType(userType: PrismaUserType): MiniLoginUserPayload["userType"] {
  if (userType === PrismaUserType.PLATFORM_ADMIN) return "PLATFORM_ADMIN";
  if (userType === PrismaUserType.ACCOUNT_ADMIN) return "ACCOUNT_ADMIN";
  return "END_USER";
}

function openidToEmail(openid: string): string {
  const digest = createHash("sha256").update(openid).digest("hex").slice(0, 32);
  return `wx_${digest}@mini.connectiq.local`;
}

export function issueMiniAuthToken(userId: string): string {
  return `mini_${userId}_${randomUUID()}`;
}

async function findUserByWechatOpenId(openid: string) {
  const identity = await prisma.userIdentity.findFirst({
    where: { provider: "wechat_mini", value: openid },
    select: { userId: true },
  });
  if (!identity) return null;

  return prisma.user.findUnique({
    where: { id: identity.userId },
    select: userSelect,
  });
}

async function findUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: { phone },
    select: userSelect,
  });
}

async function exchangeWxCode(code: string): Promise<{ openid: string }> {
  const { openid } = await code2Session(code);
  return { openid };
}

async function exchangePhoneCode(phoneCode: string): Promise<string> {
  if (!getWxMiniCredentials()) {
    if (process.env.NODE_ENV === "development") {
      const demo = await prisma.user.findFirst({
        where: { phone: "13800138000" },
        select: { phone: true },
      });
      return demo?.phone ?? "13800138000";
    }
    throw new ApiError("微信手机号授权未配置", ErrorCode.WECHAT_NOT_CONFIGURED, 500);
  }

  const accessToken = await getWechatAccessToken();
  const phoneRes = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: phoneCode }),
    },
  );
  const phoneData = (await phoneRes.json()) as {
    phone_info?: { purePhoneNumber?: string; phoneNumber?: string };
    errcode?: number;
    errmsg?: string;
  };

  const phone =
    phoneData.phone_info?.purePhoneNumber ?? phoneData.phone_info?.phoneNumber;
  if (!phone) {
    throw new ApiError(phoneData.errmsg ?? "获取手机号失败", ErrorCode.VALIDATION_ERROR, 400);
  }

  return phone;
}

async function ensureWechatIdentity(userId: string, openid: string) {
  await prisma.userIdentity.upsert({
    where: {
      userId_provider: { userId, provider: "wechat_mini" },
    },
    create: {
      userId,
      provider: "wechat_mini",
      value: openid,
      verified: true,
    },
    update: {
      value: openid,
      verified: true,
    },
  });
}

async function findOrCreateUserByOpenId(openid: string): Promise<DbUser> {
  const existing = await findUserByWechatOpenId(openid);
  if (existing) {
    await ensureWechatIdentity(existing.id, openid);
    return existing;
  }

  const email = openidToEmail(openid);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "mini_program",
      name: "微信用户",
      userType: PrismaUserType.END_USER,
      profile: {
        create: {
          accountStatus: UserAccountStatus.SHADOW,
          registrationSource: RegistrationSource.WECHAT,
        },
      },
      identities: {
        create: {
          provider: "wechat_mini",
          value: openid,
          verified: true,
        },
      },
    },
    select: userSelect,
  });

  return user;
}

async function createEndUserByPhone(phone: string): Promise<DbUser> {
  const email = `wx_${phone}@mini.connectiq.local`;
  return prisma.user.create({
    data: {
      email,
      passwordHash: "mini_program",
      name: `用户${phone.slice(-4)}`,
      phone,
      userType: PrismaUserType.END_USER,
      profile: {
        create: {
          accountStatus: UserAccountStatus.SHADOW,
          registrationSource: RegistrationSource.WECHAT,
        },
      },
    },
    select: userSelect,
  });
}

async function resolveMiniAppRoleFlags(
  userId: string,
  userType: PrismaUserType,
  orgId: string | null,
): Promise<Pick<MiniLoginUserPayload, "role" | "staff_role">> {
  if (userType !== PrismaUserType.ACCOUNT_ADMIN) {
    return { role: "ATTENDEE" };
  }

  const exhibitorAccess = await prisma.exhibitorBooth.findFirst({
    where: {
      OR: [
        { operatorUserId: userId },
        ...(orgId ? [{ companyOrgId: orgId }] : []),
        {
          companyOrg: {
            accountType: AccountType.EXHIBITOR,
            staff: {
              some: {
                userId,
                status: InviteStatus.ACCEPTED,
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (exhibitorAccess) {
    return { role: "EXHIBITOR", staff_role: "BOOTH" };
  }

  return { role: "ORGANIZER" };
}

async function buildLoginUserPayload(userId: string): Promise<MiniLoginUserPayload> {
  const [user, contactCard, intent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    }),
    prisma.contactCard.findUnique({
      where: { userId },
      select: { wechatQrUrl: true, headline: true },
    }),
    prisma.userEventIntent.findFirst({
      where: { userId },
      select: { role: true, supplyTags: true, demandTags: true, topics: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const hasProfile = Boolean(
    user.profile?.company ||
      user.profile?.valueProposition ||
      contactCard?.headline ||
      intent?.role ||
      (intent?.supplyTags.length ?? 0) > 0 ||
      (intent?.demandTags.length ?? 0) > 0 ||
      (intent?.topics.length ?? 0) > 0,
  );

  return {
    id: user.id,
    name: user.name,
    avatar: null,
    company: user.profile?.company ?? null,
    title: user.profile?.valueProposition ?? null,
    userType: mapUserType(user.userType),
    hasProfile,
    hasWechatQr: Boolean(contactCard?.wechatQrUrl),
    ...(await resolveMiniAppRoleFlags(user.id, user.userType, user.orgId)),
  };
}

async function linkUserToEvent(userId: string, eventId?: string) {
  if (!eventId) return;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  await ensureParticipantForUser(eventId, userId);
}

export async function miniWxLogin(
  code: string,
  eventId?: string,
): Promise<MiniWxLoginResult> {
  const { openid } = await exchangeWxCode(code);
  const user = await findOrCreateUserByOpenId(openid);
  await linkUserToEvent(user.id, eventId);

  // 确保名片占位存在，便于后续 hasWechatQr 判断
  await getOrCreateContactCard(user.id);

  return {
    token: issueMiniAuthToken(user.id),
    user: await buildLoginUserPayload(user.id),
  };
}

async function verifyMiniSmsCode(phone: string, code: string) {
  const allowDevBypass =
    !process.env.ALIYUN_SMS_ACCESS_KEY?.trim() &&
    phone === MINI_DEV_TEST_PHONE &&
    code === MINI_DEV_TEST_SMS_CODE;

  if (allowDevBypass) return;

  const stored = await cacheGet(smsVerifyKey(phone));
  if (!stored || stored !== code) {
    throw new ApiError("验证码错误或已过期", ErrorCode.VALIDATION_ERROR, 400);
  }

  await cacheDel(smsVerifyKey(phone));
}

/** 小程序短信验证码登录（联调 / 真机测试） */
export async function miniPhoneLogin(
  phone: string,
  code: string,
  eventId?: string,
): Promise<MiniWxLoginResult> {
  await verifyMiniSmsCode(phone, code);

  let user = await findUserByPhone(phone);
  if (!user) {
    user = await createEndUserByPhone(phone);
  }

  await linkUserToEvent(user.id, eventId);
  await getOrCreateContactCard(user.id);

  return {
    token: issueMiniAuthToken(user.id),
    user: await buildLoginUserPayload(user.id),
  };
}

export async function miniWxLoginWithPhone(
  wxCode: string,
  phoneCode: string,
  eventId?: string,
): Promise<MiniWxLoginResult> {
  const [{ openid }, phone] = await Promise.all([
    exchangeWxCode(wxCode),
    exchangePhoneCode(phoneCode),
  ]);

  let user = await findUserByPhone(phone);
  if (!user) {
    user = await createEndUserByPhone(phone);
  }

  await ensureWechatIdentity(user.id, openid);
  await linkUserToEvent(user.id, eventId);
  await getOrCreateContactCard(user.id);

  return {
    token: issueMiniAuthToken(user.id),
    user: await buildLoginUserPayload(user.id),
  };
}

/** @deprecated 使用 MiniLoginUserPayload */
export type MiniAuthUserPayload = {
  id: string;
  name: string;
  phone?: string;
  status: "SHADOW" | "ACTIVE" | "COMPLETE";
  user_type: "END_USER" | "ACCOUNT_ADMIN" | "PLATFORM_ADMIN";
  org_id?: string | null;
  avatar_url?: string;
  company?: string;
  title?: string;
};

export function formatMiniAuthUser(user: DbUser): MiniAuthUserPayload {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone ?? undefined,
    status:
      user.profile?.accountStatus === UserAccountStatus.SHADOW
        ? "SHADOW"
        : user.profile?.accountStatus === UserAccountStatus.COMPLETE
          ? "COMPLETE"
          : "ACTIVE",
    user_type: mapUserType(user.userType),
    org_id: user.orgId,
    company: user.profile?.company ?? undefined,
    title: user.profile?.valueProposition ?? undefined,
  };
}
