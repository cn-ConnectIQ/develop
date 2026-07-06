import { prisma } from "@connectiq/database";
import { WECHAT_IDENTITY } from "@/lib/wechat/constants";

export type WechatIdentityBundle = {
  miniOpenId?: string;
  mpOpenId?: string;
  unionId?: string;
};

async function reassignIdentityIfConflict(
  provider: string,
  value: string,
  userId: string,
) {
  const existing = await prisma.userIdentity.findFirst({
    where: { provider, value },
    select: { id: true, userId: true },
  });
  if (existing && existing.userId !== userId) {
    await prisma.userIdentity.delete({ where: { id: existing.id } });
  }
}

export async function findUserIdByIdentity(
  provider: string,
  value: string,
): Promise<string | null> {
  const row = await prisma.userIdentity.findFirst({
    where: { provider, value },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

export async function findUserIdByUnionId(
  unionId: string,
): Promise<string | null> {
  return findUserIdByIdentity(WECHAT_IDENTITY.UNIONID, unionId);
}

export async function findUserIdByMiniOpenId(
  openId: string,
): Promise<string | null> {
  return findUserIdByIdentity(WECHAT_IDENTITY.MINI, openId);
}

export async function findUserIdByMpOpenId(
  openId: string,
): Promise<string | null> {
  return findUserIdByIdentity(WECHAT_IDENTITY.MP, openId);
}

export async function bindWechatIdentities(
  userId: string,
  bundle: WechatIdentityBundle,
) {
  const tasks: Promise<unknown>[] = [];

  if (bundle.unionId) {
    tasks.push(
      reassignIdentityIfConflict(
        WECHAT_IDENTITY.UNIONID,
        bundle.unionId,
        userId,
      ),
    );
    tasks.push(
      prisma.userIdentity.upsert({
        where: {
          userId_provider: { userId, provider: WECHAT_IDENTITY.UNIONID },
        },
        create: {
          userId,
          provider: WECHAT_IDENTITY.UNIONID,
          value: bundle.unionId,
          verified: true,
        },
        update: { value: bundle.unionId, verified: true },
      }),
    );
  }

  if (bundle.miniOpenId) {
    tasks.push(
      reassignIdentityIfConflict(
        WECHAT_IDENTITY.MINI,
        bundle.miniOpenId,
        userId,
      ),
    );
    tasks.push(
      prisma.userIdentity.upsert({
        where: {
          userId_provider: { userId, provider: WECHAT_IDENTITY.MINI },
        },
        create: {
          userId,
          provider: WECHAT_IDENTITY.MINI,
          value: bundle.miniOpenId,
          verified: true,
        },
        update: { value: bundle.miniOpenId, verified: true },
      }),
    );
  }

  if (bundle.mpOpenId) {
    tasks.push(
      reassignIdentityIfConflict(WECHAT_IDENTITY.MP, bundle.mpOpenId, userId),
    );
    tasks.push(
      prisma.userIdentity.upsert({
        where: {
          userId_provider: { userId, provider: WECHAT_IDENTITY.MP },
        },
        create: {
          userId,
          provider: WECHAT_IDENTITY.MP,
          value: bundle.mpOpenId,
          verified: true,
        },
        update: { value: bundle.mpOpenId, verified: true },
      }),
    );
  }

  await Promise.all(tasks);
}

/** 按 UnionID → 渠道 openid 顺序解析已存在用户 */
export async function resolveUserIdFromWechatIdentities(input: {
  channel: "mini" | "mp";
  openId: string;
  unionId?: string;
}): Promise<string | null> {
  if (input.unionId) {
    const byUnion = await findUserIdByUnionId(input.unionId);
    if (byUnion) return byUnion;
  }

  if (input.channel === "mini") {
    return findUserIdByMiniOpenId(input.openId);
  }
  return findUserIdByMpOpenId(input.openId);
}
