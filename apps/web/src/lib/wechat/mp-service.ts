import {
  RegistrationSource,
  UserAccountStatus,
  UserType as PrismaUserType,
  prisma,
} from "@connectiq/database";
import { createHash } from "crypto";
import { issueMiniAuthToken } from "@/lib/mini-auth-service";
import {
  bindWechatIdentities,
  findUserIdByMpOpenId,
  resolveUserIdFromWechatIdentities,
} from "@/lib/wechat/identity";
import type { MpOAuthTokenResult } from "@/lib/wechat/mp-oauth";

function mpOpenIdToEmail(openId: string): string {
  const digest = createHash("sha256").update(openId).digest("hex").slice(0, 32);
  return `mp_${digest}@mini.connectiq.local`;
}

async function findOrCreateUserForMpSession(input: MpOAuthTokenResult) {
  const existingId = await resolveUserIdFromWechatIdentities({
    channel: "mp",
    openId: input.openid,
    unionId: input.unionid,
  });

  if (existingId) {
    const user = await prisma.user.findUnique({
      where: { id: existingId },
      select: { id: true },
    });
    if (user) {
      await bindWechatIdentities(user.id, {
        mpOpenId: input.openid,
        unionId: input.unionid,
      });
      return user.id;
    }
  }

  const user = await prisma.user.create({
    data: {
      email: mpOpenIdToEmail(input.openid),
      passwordHash: "wechat_mp",
      name: "微信用户",
      userType: PrismaUserType.END_USER,
      profile: {
        create: {
          accountStatus: UserAccountStatus.SHADOW,
          registrationSource: RegistrationSource.WECHAT,
        },
      },
    },
    select: { id: true },
  });

  await bindWechatIdentities(user.id, {
    mpOpenId: input.openid,
    unionId: input.unionid,
  });

  return user.id;
}

export async function completeMpOAuthLogin(input: MpOAuthTokenResult) {
  const userId = await findOrCreateUserForMpSession(input);
  const token = issueMiniAuthToken(userId);
  return { userId, token };
}

export async function handleMpSubscribe(mpOpenId: string, eventKey?: string) {
  const existingId = await findUserIdByMpOpenId(mpOpenId);
  if (existingId) {
    await bindWechatIdentities(existingId, { mpOpenId });
    return existingId;
  }

  const user = await prisma.user.create({
    data: {
      email: mpOpenIdToEmail(mpOpenId),
      passwordHash: "wechat_mp",
      name: "微信用户",
      userType: PrismaUserType.END_USER,
      profile: {
        create: {
          accountStatus: UserAccountStatus.SHADOW,
          registrationSource: RegistrationSource.WECHAT,
        },
      },
    },
    select: { id: true },
  });

  await bindWechatIdentities(user.id, { mpOpenId });
  void eventKey;
  return user.id;
}

export async function handleMpUnsubscribe(mpOpenId: string) {
  await prisma.userIdentity.deleteMany({
    where: { provider: "wechat_mp", value: mpOpenId },
  });
}
