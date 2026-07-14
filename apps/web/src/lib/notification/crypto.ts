import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer | null {
  const raw = process.env.NOTIFICATION_PII_KEY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NOTIFICATION_PII_KEY 未配置");
    }
    return null;
  }
  return createHash("sha256").update(raw).digest();
}

/** 加密手机号/邮箱存储到 recipient_cipher */
export function encryptRecipient(plaintext: string): string {
  const key = getKey();
  if (!key) {
    return `plain:${plaintext}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptRecipient(cipherText: string): string {
  if (cipherText.startsWith("plain:")) {
    return cipherText.slice("plain:".length);
  }
  const key = getKey();
  if (!key) {
    throw new Error("无法解密：缺少 NOTIFICATION_PII_KEY");
  }
  const parts = cipherText.split(":");
  if (parts[0] !== "v1" || parts.length !== 4) {
    throw new Error("recipient_cipher 格式无效");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** 退订名单只存哈希 */
export function hashIdentityValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  const salt = process.env.NOTIFICATION_OPTOUT_SALT?.trim() || "connectiq-optout";
  return createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
}

export function generateOpaqueToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}
