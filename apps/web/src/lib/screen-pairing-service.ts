import crypto from "crypto";
import { prisma, type Prisma } from "@connectiq/database";

export type ScreenInteractionType = "POLL" | "LOTTERY" | "QA";

export type ScreenBindingRecord = {
  pairingToken: string;
  eventId: string;
  interactionType: ScreenInteractionType;
  interactionId: string;
  interactionName: string;
  boundAt: string;
  lastHeartbeatAt: string | null;
};

export type ScreenStatusPayload = {
  paired: boolean;
  screenOnline: boolean;
  interactionType?: ScreenInteractionType;
  interactionName?: string;
  boundAt?: string;
};

const TOKEN_TTL_MS = 10 * 60 * 1000;
const ONLINE_WINDOW_MS = 45 * 1000;

function pairingSecret(): string {
  return (
    process.env.SCREEN_PAIRING_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "connectiq-dev-screen-pairing"
  );
}

function bindingKey(interactionId: string): string {
  return `screen_interaction:${interactionId}`;
}

function tokenKey(token: string): string {
  return `screen_token:${token}`;
}

export function createPairingToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = crypto
    .createHmac("sha256", pairingSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifyPairingToken(token: string): boolean {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = crypto
    .createHmac("sha256", pairingSecret())
    .update(`${expStr}.${nonce}`)
    .digest("hex")
    .slice(0, 16);
  return sig === expected;
}

function parseBinding(value: unknown): ScreenBindingRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const pairingToken = String(row.pairingToken ?? "").trim();
  const eventId = String(row.eventId ?? "").trim();
  const interactionId = String(row.interactionId ?? "").trim();
  const interactionType = String(row.interactionType ?? "").trim() as ScreenInteractionType;
  if (!pairingToken || !eventId || !interactionId) return null;
  if (!["POLL", "LOTTERY", "QA"].includes(interactionType)) return null;
  return {
    pairingToken,
    eventId,
    interactionType,
    interactionId,
    interactionName: String(row.interactionName ?? "").trim() || "互动",
    boundAt: String(row.boundAt ?? new Date().toISOString()),
    lastHeartbeatAt:
      row.lastHeartbeatAt == null ? null : String(row.lastHeartbeatAt),
  };
}

function isOnline(binding: ScreenBindingRecord): boolean {
  if (!binding.lastHeartbeatAt) return false;
  const ts = new Date(binding.lastHeartbeatAt).getTime();
  return Number.isFinite(ts) && Date.now() - ts <= ONLINE_WINDOW_MS;
}

async function resolveInteractionEventId(
  interactionId: string,
): Promise<string | null> {
  const poll = await prisma.poll.findUnique({
    where: { id: interactionId },
    select: { eventId: true },
  });
  if (poll) return poll.eventId;

  const lottery = await prisma.lottery.findUnique({
    where: { id: interactionId },
    select: { eventId: true },
  });
  if (lottery) return lottery.eventId;

  const session = await prisma.interactionSession.findUnique({
    where: { id: interactionId },
    select: { eventId: true },
  });
  if (session) return session.eventId;

  return null;
}

async function readBinding(
  eventId: string,
  interactionId: string,
): Promise<ScreenBindingRecord | null> {
  const setting = await prisma.eventSetting.findUnique({
    where: {
      eventId_key: { eventId, key: bindingKey(interactionId) },
    },
  });
  if (!setting?.value) return null;
  return parseBinding(setting.value);
}

async function writeBinding(
  eventId: string,
  binding: ScreenBindingRecord,
): Promise<void> {
  const json = binding as unknown as Prisma.InputJsonValue;
  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: bindingKey(binding.interactionId) },
    },
    create: {
      eventId,
      key: bindingKey(binding.interactionId),
      value: json,
    },
    update: { value: json },
  });
  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: tokenKey(binding.pairingToken) },
    },
    create: {
      eventId,
      key: tokenKey(binding.pairingToken),
      value: json,
    },
    update: { value: json },
  });
}

export async function getInteractionScreenStatus(
  interactionId: string,
  eventIdHint?: string,
): Promise<ScreenStatusPayload> {
  const eventId =
    eventIdHint ?? (await resolveInteractionEventId(interactionId));
  if (!eventId) {
    return { paired: false, screenOnline: false };
  }

  const binding = await readBinding(eventId, interactionId);
  if (!binding) {
    return { paired: false, screenOnline: false };
  }

  return {
    paired: true,
    screenOnline: isOnline(binding),
    interactionType: binding.interactionType,
    interactionName: binding.interactionName,
    boundAt: binding.boundAt,
  };
}

export async function bindScreenPairingToken(input: {
  token: string;
  eventId: string;
  interactionType: ScreenInteractionType;
  interactionId: string;
  interactionName: string;
}): Promise<ScreenBindingRecord> {
  if (!verifyPairingToken(input.token)) {
    throw new Error("TOKEN_EXPIRED");
  }

  const resolvedEventId = await resolveInteractionEventId(input.interactionId);
  if (resolvedEventId && resolvedEventId !== input.eventId) {
    throw new Error("互动与活动不匹配");
  }

  const now = new Date().toISOString();
  const binding: ScreenBindingRecord = {
    pairingToken: input.token.trim(),
    eventId: input.eventId,
    interactionType: input.interactionType,
    interactionId: input.interactionId,
    interactionName: input.interactionName.trim() || "互动",
    boundAt: now,
    lastHeartbeatAt: now,
  };

  await writeBinding(input.eventId, binding);
  return binding;
}

export async function touchScreenPairingHeartbeat(
  token: string,
): Promise<ScreenBindingRecord | null> {
  if (!verifyPairingToken(token)) {
    throw new Error("TOKEN_EXPIRED");
  }

  const setting = await prisma.eventSetting.findFirst({
    where: { key: tokenKey(token) },
  });
  const binding = parseBinding(setting?.value);
  if (!binding) return null;

  const next: ScreenBindingRecord = {
    ...binding,
    lastHeartbeatAt: new Date().toISOString(),
  };
  await writeBinding(binding.eventId, next);
  return next;
}

export async function getBindingByToken(
  token: string,
): Promise<ScreenBindingRecord | null> {
  const setting = await prisma.eventSetting.findFirst({
    where: { key: tokenKey(token) },
  });
  return parseBinding(setting?.value);
}
