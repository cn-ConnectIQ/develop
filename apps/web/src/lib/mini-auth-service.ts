import { randomUUID } from "crypto";
import {
  RegistrationSource,
  UserAccountStatus,
  UserType as PrismaUserType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

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

const userSelect = {
  id: true,
  name: true,
  phone: true,
  userType: true,
  activeOrgId: true,
  profile: {
    select: {
      company: true,
      accountStatus: true,
    },
  },
} as const;

type DbUser = NonNullable<Awaited<ReturnType<typeof findUserByPhone>>>;

function mapAccountStatus(status: UserAccountStatus): MiniAuthUserPayload["status"] {
  if (status === UserAccountStatus.SHADOW) return "SHADOW";
  if (status === UserAccountStatus.COMPLETE) return "COMPLETE";
  return "ACTIVE";
}

function mapUserType(userType: PrismaUserType): MiniAuthUserPayload["user_type"] {
  if (userType === PrismaUserType.PLATFORM_ADMIN) return "PLATFORM_ADMIN";
  if (userType === PrismaUserType.ACCOUNT_ADMIN) return "ACCOUNT_ADMIN";
  return "END_USER";
}

export function formatMiniAuthUser(user: DbUser): MiniAuthUserPayload {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone ?? undefined,
    status: mapAccountStatus(user.profile?.accountStatus ?? UserAccountStatus.ACTIVE),
    user_type: mapUserType(user.userType),
    org_id: user.activeOrgId,
    company: user.profile?.company ?? undefined,
  };
}

export function issueMiniAuthToken(userId: string): string {
  return `mini_${userId}_${randomUUID()}`;
}

async function findUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: { phone },
    select: userSelect,
  });
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

async function exchangeWxCode(code: string): Promise<{ openid: string; sessionKey?: string }> {
  const appId = process.env.WECHAT_MINI_APP_ID;
  const secret = process.env.WECHAT_MINI_APP_SECRET;

  if (!appId || !secret) {
    if (process.env.NODE_ENV === "development") {
      return { openid: `dev-openid-${code.slice(0, 8) || "mock"}` };
    }
    throw new ApiError("微信登录未配置", ErrorCode.INTERNAL_ERROR, 500);
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url);
  const data = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };

  if (!data.openid) {
    throw new ApiError(data.errmsg ?? "微信登录失败", ErrorCode.VALIDATION_ERROR, 400);
  }

  return { openid: data.openid };
}

async function exchangePhoneCode(phoneCode: string): Promise<string> {
  const appId = process.env.WECHAT_MINI_APP_ID;
  const secret = process.env.WECHAT_MINI_APP_SECRET;

  if (!appId || !secret) {
    if (process.env.NODE_ENV === "development") {
      const demo = await prisma.user.findFirst({
        where: { phone: "13800138000" },
        select: { phone: true },
      });
      return demo?.phone ?? "13800138000";
    }
    throw new ApiError("微信手机号授权未配置", ErrorCode.INTERNAL_ERROR, 500);
  }

  const tokenRes = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`,
  );
  const tokenData = (await tokenRes.json()) as { access_token?: string; errcode?: number };
  if (!tokenData.access_token) {
    throw new ApiError("获取微信 access_token 失败", ErrorCode.INTERNAL_ERROR, 500);
  }

  const phoneRes = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${tokenData.access_token}`,
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

  const phone = phoneData.phone_info?.purePhoneNumber ?? phoneData.phone_info?.phoneNumber;
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

async function createEndUserByPhone(phone: string): Promise<DbUser> {
  const email = `wx_${phone}@mini.connectiq.local`;
  const user = await prisma.user.create({
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
  return user;
}

export async function miniWxLogin(code: string) {
  const { openid } = await exchangeWxCode(code);
  let user = await findUserByWechatOpenId(openid);

  if (!user) {
    throw new ApiError("请先授权手机号完成注册", ErrorCode.UNAUTHORIZED, 401);
  }

  await ensureWechatIdentity(user.id, openid);

  return {
    openid,
    token: issueMiniAuthToken(user.id),
    user: formatMiniAuthUser(user),
  };
}

export async function miniWxLoginWithPhone(wxCode: string, phoneCode: string) {
  const [{ openid }, phone] = await Promise.all([
    exchangeWxCode(wxCode),
    exchangePhoneCode(phoneCode),
  ]);

  let user = await findUserByPhone(phone);

  if (!user) {
    user = await createEndUserByPhone(phone);
  }

  await ensureWechatIdentity(user.id, openid);

  return {
    token: issueMiniAuthToken(user.id),
    user: formatMiniAuthUser(user),
  };
}
