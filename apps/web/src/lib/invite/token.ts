import { createHash, randomBytes } from "crypto";
import { prisma } from "@connectiq/database";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 8 位 base62，不可枚举，不含身份信息 */
export function generateInviteShortToken(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE62[bytes[i]! % 62];
  }
  return out;
}

export async function allocateUniqueInviteToken(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const token = generateInviteShortToken(8);
    const exists = await prisma.inviteRecord.findUnique({
      where: { activationToken: token },
      select: { id: true },
    });
    if (!exists) return token;
  }
  throw new Error("无法分配邀请 token");
}

/** 手机号哈希（与通知退订哈希隔离盐，便于独立轮换） */
export function hashInvitePhone(phone: string): string {
  const normalized = phone.replace(/\D/g, "").trim();
  const salt =
    process.env.INVITE_PHONE_HASH_SALT?.trim() ||
    process.env.NOTIFICATION_OPTOUT_SALT?.trim() ||
    "connectiq-invite-phone";
  return createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
}

export function phonesMatchHash(phone: string, phoneHash: string | null | undefined) {
  if (!phoneHash) return false;
  return hashInvitePhone(phone) === phoneHash;
}

export { buildInviteShortUrl } from "@/lib/invite/invite-url";
