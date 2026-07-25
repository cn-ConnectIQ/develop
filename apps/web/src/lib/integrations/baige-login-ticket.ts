import { randomUUID } from "crypto";
import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";
import {
  linkBaigeIdentityToOrg,
  resolveOrCreateUserFromBaigeIdentity,
  type BaigeIdentityInput,
} from "@/lib/integrations/baige-identity-link";
import {
  BaigeConnectionError,
  getBaigeConnectionByExternalOrgId,
} from "@/lib/integrations/baige-connection-service";
import { PartnerConnectionStatus } from "@connectiq/database";

const LOGIN_TICKET_TTL = 120;
const QR_SESSION_TTL = 180;

export function baigeSsoLoginKey(token: string) {
  return `baige-sso-login:${token}`;
}

function qrSessionKey(sessionId: string) {
  return `baige-qr-login:${sessionId}`;
}

export async function issueBaigeLoginTicket(userId: string) {
  const loginToken = randomUUID();
  await cacheSet(baigeSsoLoginKey(loginToken), userId, LOGIN_TICKET_TTL);
  return {
    loginToken,
    expiresIn: LOGIN_TICKET_TTL,
  };
}

/**
 * 百格已绑定组织时：用邮箱/手机换一次性登录票据。
 * 会确保该用户具备该组织管理权限（首次登录自动补齐）。
 */
export async function createBaigeLoginTicketForIdentity(input: {
  baigeOrgId: string;
  identity: BaigeIdentityInput;
}) {
  const conn = await getBaigeConnectionByExternalOrgId(input.baigeOrgId);
  if (!conn || conn.status !== PartnerConnectionStatus.ACTIVE) {
    throw new BaigeConnectionError("百格组织未绑定玖莅", "NOT_LINKED");
  }

  const userId = await linkBaigeIdentityToOrg({
    orgId: conn.orgId,
    identity: input.identity,
  });

  const ticket = await issueBaigeLoginTicket(userId);
  return {
    ...ticket,
    userId,
    jiuliOrgId: conn.orgId,
  };
}

export type QrLoginSessionState =
  | {
      status: "pending";
      createdAt: string;
    }
  | {
      status: "confirmed";
      createdAt: string;
      confirmedAt: string;
      loginToken: string;
      userId: string;
    }
  | {
      status: "expired";
    };

export async function createQrLoginSession() {
  const sessionId = randomUUID().replace(/-/g, "");
  const payload: QrLoginSessionState = {
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await cacheSet(qrSessionKey(sessionId), JSON.stringify(payload), QR_SESSION_TTL);
  return {
    sessionId,
    expiresIn: QR_SESSION_TTL,
    /** 百格 App 识别此 deep link / 查询串 */
    deepLink: `bagevent://jiuli/qr-login?sessionId=${sessionId}`,
    pollPath: `/api/auth/qr-login/${sessionId}`,
  };
}

export async function getQrLoginSession(
  sessionId: string,
): Promise<QrLoginSessionState> {
  const raw = await cacheGet(qrSessionKey(sessionId));
  if (!raw) return { status: "expired" };
  try {
    return JSON.parse(raw) as QrLoginSessionState;
  } catch {
    return { status: "expired" };
  }
}

/** 百格 App 扫码确认：校验组织绑定 + 身份 → 签发 loginToken */
export async function confirmQrLoginSession(input: {
  sessionId: string;
  baigeOrgId: string;
  identity: BaigeIdentityInput;
}) {
  const current = await getQrLoginSession(input.sessionId);
  if (current.status === "expired") {
    throw new BaigeConnectionError("二维码已过期，请刷新后重试", "QR_EXPIRED");
  }
  if (current.status === "confirmed") {
    return {
      loginToken: current.loginToken,
      alreadyConfirmed: true,
    };
  }

  const ticket = await createBaigeLoginTicketForIdentity({
    baigeOrgId: input.baigeOrgId,
    identity: input.identity,
  });

  const next: QrLoginSessionState = {
    status: "confirmed",
    createdAt: current.createdAt,
    confirmedAt: new Date().toISOString(),
    loginToken: ticket.loginToken,
    userId: ticket.userId,
  };
  await cacheSet(
    qrSessionKey(input.sessionId),
    JSON.stringify(next),
    LOGIN_TICKET_TTL,
  );

  return {
    loginToken: ticket.loginToken,
    alreadyConfirmed: false,
    jiuliOrgId: ticket.jiuliOrgId,
  };
}

export async function consumeBaigeLoginTicket(loginToken: string) {
  const key = baigeSsoLoginKey(loginToken);
  const userId = await cacheGet(key);
  if (!userId) return null;
  await cacheDel(key);
  return userId;
}

/** 仅解析身份不强制 org（内部用） */
export async function resolveBaigeUserId(identity: BaigeIdentityInput) {
  return resolveOrCreateUserFromBaigeIdentity(identity);
}
