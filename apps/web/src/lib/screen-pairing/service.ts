import crypto from "crypto";
import {
  InteractionType,
  PairingStatus,
  prisma,
  type ScreenPairing,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api-auth";
import {
  hasBoothStaffAccess,
  resolveScanOperatorRole,
  type ScanOperatorRole,
} from "@/lib/scan/permissions";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { broadcastScreenPairingPaired } from "@/lib/screen-pairing/realtime";

export const TOKEN_TTL_SECONDS = 90;
export const ONLINE_WINDOW_MS = 30 * 1000;

export type ScreenPairingDisplayTarget = {
  pollId: string | null;
  lotteryId: string | null;
};

export type ScreenPairingStatusPayload = {
  id: string;
  pairingToken: string;
  status: PairingStatus;
  tokenExpiresAt: string;
  expiresIn?: number;
  screenOnline: boolean;
  eventId: string | null;
  eventName: string | null;
  interactionType: InteractionType | null;
  interactionId: string | null;
  interactionName: string | null;
  displayTarget: ScreenPairingDisplayTarget | null;
  pairedBy: string | null;
  pairedAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
};

type InteractionRefJson = { type?: string; id?: string };

export async function resolveInteractionDisplayTarget(
  interactionType: InteractionType | null,
  interactionId: string | null,
): Promise<ScreenPairingDisplayTarget | null> {
  if (!interactionType || !interactionId) return null;

  if (interactionType === InteractionType.POLL) {
    return { pollId: interactionId, lotteryId: null };
  }

  if (interactionType === InteractionType.LOTTERY) {
    return { pollId: null, lotteryId: interactionId };
  }

  const session = await prisma.interactionSession.findUnique({
    where: { id: interactionId },
    select: { interactions: true },
  });

  if (session?.interactions && Array.isArray(session.interactions)) {
    for (const item of session.interactions as InteractionRefJson[]) {
      if (item.type === "poll" && item.id) {
        return { pollId: item.id, lotteryId: null };
      }
      if (item.type === "lottery" && item.id) {
        return { pollId: null, lotteryId: item.id };
      }
    }
  }

  const poll = await prisma.poll.findUnique({
    where: { id: interactionId },
    select: { id: true },
  });
  if (poll) {
    return { pollId: poll.id, lotteryId: null };
  }

  return { pollId: interactionId, lotteryId: null };
}

export async function serializeScreenPairingDetailed(
  record: ScreenPairing,
): Promise<ScreenPairingStatusPayload> {
  const base = serializeScreenPairing(record);
  const displayTarget =
    record.status === PairingStatus.PAIRED
      ? await resolveInteractionDisplayTarget(
          record.interactionType,
          record.interactionId,
        )
      : null;

  return { ...base, displayTarget };
}

function generatePairingToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "c";
  const bytes = crypto.randomBytes(24);
  for (let i = 0; i < 24; i += 1) {
    id += chars[bytes[i]! % chars.length]!;
  }
  return id;
}

function tokenExpiresAtFromNow() {
  return new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);
}

export function buildQrContent(pairingToken: string): string {
  return `CIQ:SCREEN:${pairingToken}`;
}

export function expiresInSeconds(tokenExpiresAt: Date): number {
  return Math.max(0, Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000));
}

export function isWaitingTokenExpired(record: {
  tokenExpiresAt: Date;
  status: PairingStatus;
}): boolean {
  return (
    record.status === PairingStatus.WAITING &&
    record.tokenExpiresAt.getTime() <= Date.now()
  );
}

export function isScreenOnline(lastHeartbeatAt: Date | null | undefined): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - lastHeartbeatAt.getTime() <= ONLINE_WINDOW_MS;
}

export function serializeScreenPairing(record: ScreenPairing): ScreenPairingStatusPayload {
  const waitingExpired = isWaitingTokenExpired(record);
  const effectiveStatus =
    record.status === PairingStatus.WAITING && waitingExpired
      ? PairingStatus.EXPIRED
      : record.status;

  return {
    id: record.id,
    pairingToken: record.pairingToken,
    status: effectiveStatus,
    tokenExpiresAt: record.tokenExpiresAt.toISOString(),
    expiresIn:
      effectiveStatus === PairingStatus.WAITING
        ? expiresInSeconds(record.tokenExpiresAt)
        : undefined,
    screenOnline: isScreenOnline(record.lastHeartbeatAt),
    eventId: record.eventId,
    eventName: record.eventNameCache,
    interactionType: record.interactionType,
    interactionId: record.interactionId,
    interactionName: record.interactionName,
    displayTarget: null,
    pairedBy: record.pairedBy,
    pairedAt: record.pairedAt?.toISOString() ?? null,
    lastHeartbeatAt: record.lastHeartbeatAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function getScreenPairingByToken(token: string): Promise<ScreenPairing> {
  const record = await prisma.screenPairing.findUnique({
    where: { pairingToken: token.trim() },
  });
  if (!record) {
    throw new ApiError("配对会话不存在", ErrorCode.NOT_FOUND, 404);
  }
  return record;
}

export async function createWaitingScreenPairing(): Promise<ScreenPairing> {
  return prisma.screenPairing.create({
    data: {
      status: PairingStatus.WAITING,
      tokenExpiresAt: tokenExpiresAtFromNow(),
    },
  });
}

export async function markWaitingExpiredIfNeeded(record: ScreenPairing): Promise<ScreenPairing> {
  if (!isWaitingTokenExpired(record)) return record;
  return prisma.screenPairing.update({
    where: { id: record.id },
    data: { status: PairingStatus.EXPIRED },
  });
}

export async function refreshScreenPairingToken(token: string): Promise<
  | { kind: "waiting"; record: ScreenPairing; expiresIn: number }
  | { kind: "refreshed"; record: ScreenPairing; expiresIn: number }
  | { kind: "paired"; record: ScreenPairing }
> {
  let record = await getScreenPairingByToken(token);

  if (record.status === PairingStatus.PAIRED) {
    return { kind: "paired", record };
  }

  if (record.status === PairingStatus.EXPIRED || isWaitingTokenExpired(record)) {
    const nextToken = generatePairingToken();
    record = await prisma.screenPairing.update({
      where: { id: record.id },
      data: {
        pairingToken: nextToken,
        tokenExpiresAt: tokenExpiresAtFromNow(),
        status: PairingStatus.WAITING,
      },
    });
    return { kind: "refreshed", record, expiresIn: TOKEN_TTL_SECONDS };
  }

  return {
    kind: "waiting",
    record,
    expiresIn: expiresInSeconds(record.tokenExpiresAt),
  };
}

async function resolveInteractionContext(
  eventId: string,
  interactionType: InteractionType,
  interactionId: string,
): Promise<{ eventName: string; boothId: string | null }> {
  switch (interactionType) {
    case InteractionType.POLL: {
      const poll = await prisma.poll.findUnique({
        where: { id: interactionId },
        select: {
          eventId: true,
          title: true,
          event: { select: { name: true } },
        },
      });
      if (!poll || poll.eventId !== eventId) {
        throw new ApiError("互动不存在", ErrorCode.NOT_FOUND, 404);
      }
      return { eventName: poll.event.name, boothId: null };
    }
    case InteractionType.LOTTERY: {
      const lottery = await prisma.lottery.findUnique({
        where: { id: interactionId },
        select: {
          eventId: true,
          title: true,
          boothId: true,
          event: { select: { name: true } },
        },
      });
      if (!lottery || lottery.eventId !== eventId) {
        throw new ApiError("互动不存在", ErrorCode.NOT_FOUND, 404);
      }
      return { eventName: lottery.event.name, boothId: lottery.boothId };
    }
    case InteractionType.QA: {
      const session = await prisma.interactionSession.findUnique({
        where: { id: interactionId },
        select: {
          eventId: true,
          name: true,
          boothId: true,
          event: { select: { name: true } },
        },
      });
      if (!session || session.eventId !== eventId) {
        throw new ApiError("互动不存在", ErrorCode.NOT_FOUND, 404);
      }
      return { eventName: session.event.name, boothId: session.boothId };
    }
    default:
      throw new ApiError("不支持的互动类型", ErrorCode.VALIDATION_ERROR, 400);
  }
}

async function assertExhibitorInteractionAccess(
  userId: string,
  eventId: string,
  boothId: string | null,
): Promise<void> {
  if (!boothId) {
    throw new ApiError("展商只能绑定展位相关互动", ErrorCode.FORBIDDEN, 403);
  }
  const allowed = await hasBoothStaffAccess(userId, eventId, boothId);
  if (!allowed) {
    throw new ApiError("无权绑定此互动", ErrorCode.FORBIDDEN, 403);
  }
}

export async function requireScreenPairingBindOperator(
  request: Request,
  eventId: string,
): Promise<{ userId: string; role: ScanOperatorRole }> {
  const userId = await resolveMobileUserId(request);
  const role = await resolveScanOperatorRole(userId, eventId);
  if (role !== "ORGANIZER" && role !== "EXHIBITOR") {
    throw new ApiError("仅主办方可绑定大屏", ErrorCode.FORBIDDEN, 403);
  }
  return { userId, role };
}

export function expiredPairingResponse() {
  return NextResponse.json(
    { error: "二维码已过期,请刷新页面重新扫码", code: "EXPIRED" },
    { status: 410 },
  );
}

export class ScreenPairingExpiredError extends Error {
  constructor() {
    super("二维码已过期,请刷新页面重新扫码");
    this.name = "ScreenPairingExpiredError";
  }
}

export async function bindScreenPairing(input: {
  token: string;
  userId: string;
  role: ScanOperatorRole;
  eventId: string;
  interactionType: InteractionType;
  interactionId: string;
  interactionName: string;
}): Promise<{
  paired: true;
  eventName: string;
  interactionName: string;
  record: ScreenPairing;
}> {
  let record = await getScreenPairingByToken(input.token);

  if (record.status !== PairingStatus.WAITING || isWaitingTokenExpired(record)) {
    if (record.status === PairingStatus.WAITING && isWaitingTokenExpired(record)) {
      await prisma.screenPairing.update({
        where: { id: record.id },
        data: { status: PairingStatus.EXPIRED },
      });
    }
    throw new ScreenPairingExpiredError();
  }

  const interaction = await resolveInteractionContext(
    input.eventId,
    input.interactionType,
    input.interactionId,
  );

  if (input.role === "EXHIBITOR") {
    await assertExhibitorInteractionAccess(
      input.userId,
      input.eventId,
      interaction.boothId,
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const now = new Date();
  const interactionName = input.interactionName.trim() || "互动";

  record = await prisma.screenPairing.update({
    where: { id: record.id },
    data: {
      status: PairingStatus.PAIRED,
      eventId: input.eventId,
      eventNameCache: event.name,
      interactionType: input.interactionType,
      interactionId: input.interactionId,
      interactionName,
      pairedBy: input.userId,
      pairedAt: now,
      lastHeartbeatAt: now,
    },
  });

  await broadcastScreenPairingPaired(record.pairingToken, {
    eventId: input.eventId,
    eventName: event.name,
    interactionType: input.interactionType,
    interactionId: input.interactionId,
    interactionName,
    pairedAt: now.toISOString(),
  });

  return {
    paired: true,
    eventName: event.name,
    interactionName,
    record,
  };
}

export async function touchScreenPairingHeartbeat(token: string): Promise<ScreenPairing> {
  const record = await getScreenPairingByToken(token);
  return prisma.screenPairing.update({
    where: { id: record.id },
    data: { lastHeartbeatAt: new Date() },
  });
}

export async function resetScreenPairing(token: string): Promise<ScreenPairing> {
  const record = await getScreenPairingByToken(token);
  const now = new Date();

  return prisma.screenPairing.update({
    where: { id: record.id },
    data: {
      status: PairingStatus.WAITING,
      tokenExpiresAt: tokenExpiresAtFromNow(),
      eventId: null,
      eventNameCache: null,
      interactionType: null,
      interactionId: null,
      interactionName: null,
      pairedBy: null,
      pairedAt: null,
      lastHeartbeatAt: now,
    },
  });
}

export async function resolveInteractionEventId(
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

export async function getInteractionScreenPairingStatus(interactionId: string): Promise<{
  paired: boolean;
  screenOnline: boolean;
}> {
  const pairing = await prisma.screenPairing.findFirst({
    where: {
      interactionId,
      status: PairingStatus.PAIRED,
    },
    orderBy: { pairedAt: "desc" },
    select: { lastHeartbeatAt: true },
  });

  return {
    paired: Boolean(pairing),
    screenOnline: pairing ? isScreenOnline(pairing.lastHeartbeatAt) : false,
  };
}
