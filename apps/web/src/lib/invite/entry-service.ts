import {
  InviteEntryStatus,
  prisma,
  type InviteEntry,
} from "@connectiq/database";
import { normalizeInvitePhone } from "@/lib/invite/phone";
import { generateInviteShortToken } from "@/lib/invite/token";

/** 小程序 AC1 落地页（固定） */
export const INVITE_ENTRY_MINI_PAGE = "pages/activation/landing";

/** scene 前缀：`t_` + token，总长 ≤ 32 → token ≤ 30 */
export const INVITE_ENTRY_SCENE_PREFIX = "t_";

/** 推荐 token 长度：20（scene 总长 22） */
export const INVITE_ENTRY_TOKEN_LENGTH = 20;

export type InviteEntryMode = "personal" | "event";

export type InviteEntryCreateInput = {
  eventId: string;
  /** 有值=个人受邀；空/省略=活动通用码 */
  phone?: string | null;
  honorific?: string | null;
  name?: string | null;
  participantId?: string | null;
  /** 默认复用未过期 PENDING；true 则作废旧码并新建 */
  force?: boolean;
  expiresAt?: Date | null;
  createdBy?: string | null;
};

export type InviteEntryDto = {
  token: string;
  eventId: string;
  phone: string | null;
  mode: InviteEntryMode;
  honorific: string | null;
  name: string | null;
  participantId: string | null;
  status: InviteEntryStatus;
  miniProgramPath: string;
  scene: string;
  expiresAt: string | null;
  createdAt: string;
};

export class InviteEntryError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 410,
    public code: "BAD_REQUEST" | "NOT_FOUND" | "GONE",
  ) {
    super(message);
  }
}

export function inviteEntryMode(phone: string | null | undefined): InviteEntryMode {
  return phone ? "personal" : "event";
}

export function buildInviteEntryScene(token: string): string {
  const scene = `${INVITE_ENTRY_SCENE_PREFIX}${token}`;
  if (scene.length > 32) {
    throw new Error(`scene 超长（${scene.length} > 32）`);
  }
  return scene;
}

export function buildInviteEntryMiniPath(token: string): string {
  return `${INVITE_ENTRY_MINI_PAGE}?t=${encodeURIComponent(token)}`;
}

export function parseInviteEntryToken(input: {
  token?: string | null;
  scene?: string | null;
}): string {
  const rawToken = input.token?.trim();
  if (rawToken) return rawToken;

  const scene = input.scene?.trim();
  if (!scene) {
    throw new InviteEntryError("缺少 token 或 scene", 400, "BAD_REQUEST");
  }

  if (scene.startsWith(INVITE_ENTRY_SCENE_PREFIX)) {
    const token = scene.slice(INVITE_ENTRY_SCENE_PREFIX.length).trim();
    if (!token) {
      throw new InviteEntryError("scene 格式无效", 400, "BAD_REQUEST");
    }
    return token;
  }

  if (/^[A-Za-z0-9]{8,30}$/.test(scene)) return scene;

  throw new InviteEntryError("scene 须为 t_<token> 格式", 400, "BAD_REQUEST");
}

function toDto(row: InviteEntry): InviteEntryDto {
  return {
    token: row.token,
    eventId: row.eventId,
    phone: row.phone,
    mode: inviteEntryMode(row.phone),
    honorific: row.honorific,
    name: row.name,
    participantId: row.participantId,
    status: row.status,
    miniProgramPath: buildInviteEntryMiniPath(row.token),
    scene: buildInviteEntryScene(row.token),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function allocateEntryToken(): Promise<string> {
  for (let i = 0; i < 16; i++) {
    const token = generateInviteShortToken(INVITE_ENTRY_TOKEN_LENGTH);
    const exists = await prisma.inviteEntry.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!exists) return token;
  }
  for (let i = 0; i < 8; i++) {
    const token = generateInviteShortToken(24);
    const exists = await prisma.inviteEntry.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!exists) return token;
  }
  throw new Error("无法分配 entryToken");
}

function isUsable(row: InviteEntry, now = new Date()): boolean {
  if (row.status === InviteEntryStatus.REVOKED) return false;
  if (row.status === InviteEntryStatus.USED) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return false;
  return row.status === InviteEntryStatus.PENDING;
}

function resolveCreatePhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const phone = normalizeInvitePhone(trimmed);
  if (!phone) {
    throw new InviteEntryError("请输入有效的中国大陆手机号", 400, "BAD_REQUEST");
  }
  return phone;
}

/**
 * 创建或复用入口：
 * - personal：同一 (eventId, phone) 复用未过期 PENDING
 * - event：同一 eventId 且 phone IS NULL 复用未过期 PENDING
 * force=true 时撤销旧 PENDING 并签发新 token。
 */
export async function createOrReuseInviteEntry(
  input: InviteEntryCreateInput,
): Promise<InviteEntryDto> {
  const phone = resolveCreatePhone(input.phone);
  const honorific = input.honorific?.trim() || null;
  const name = input.name?.trim() || null;
  const participantId = input.participantId?.trim() || null;

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true },
  });
  if (!event) {
    throw new InviteEntryError("活动不存在", 404, "NOT_FOUND");
  }

  if (participantId) {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, eventId: input.eventId },
      select: { id: true },
    });
    if (!participant) {
      throw new InviteEntryError("参会者不存在或不属于该活动", 400, "BAD_REQUEST");
    }
  }

  const now = new Date();
  const phoneFilter = phone === null ? { phone: null } : { phone };

  if (!input.force) {
    const existing = await prisma.inviteEntry.findFirst({
      where: {
        eventId: input.eventId,
        ...phoneFilter,
        status: InviteEntryStatus.PENDING,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing && isUsable(existing, now)) {
      if (
        (honorific && honorific !== existing.honorific) ||
        (name && name !== existing.name) ||
        (participantId && participantId !== existing.participantId)
      ) {
        const updated = await prisma.inviteEntry.update({
          where: { id: existing.id },
          data: {
            honorific: honorific ?? existing.honorific,
            name: name ?? existing.name,
            participantId: participantId ?? existing.participantId,
          },
        });
        return toDto(updated);
      }
      return toDto(existing);
    }
  } else {
    await prisma.inviteEntry.updateMany({
      where: {
        eventId: input.eventId,
        ...phoneFilter,
        status: InviteEntryStatus.PENDING,
      },
      data: { status: InviteEntryStatus.REVOKED },
    });
  }

  const token = await allocateEntryToken();
  const created = await prisma.inviteEntry.create({
    data: {
      token,
      eventId: input.eventId,
      phone,
      honorific,
      name,
      participantId,
      status: InviteEntryStatus.PENDING,
      expiresAt: input.expiresAt ?? null,
      createdBy: input.createdBy ?? null,
    },
  });

  return toDto(created);
}

export type InviteEntryResolveResult = {
  eventId: string;
  phone: string | null;
  mode: InviteEntryMode;
  eventName: string;
  honorific: string | null;
  name: string | null;
  participantId: string | null;
  status: InviteEntryStatus;
};

/** 小程序兑换入口（匿名）；不在此处标记 USED */
export async function resolveInviteEntry(input: {
  token?: string | null;
  scene?: string | null;
}): Promise<InviteEntryResolveResult> {
  const token = parseInviteEntryToken(input);
  const row = await prisma.inviteEntry.findUnique({
    where: { token },
    include: {
      event: { select: { id: true, name: true } },
    },
  });

  if (!row) {
    throw new InviteEntryError("入口无效或不存在", 404, "NOT_FOUND");
  }

  if (row.status === InviteEntryStatus.REVOKED) {
    throw new InviteEntryError("入口已撤销", 410, "GONE");
  }

  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    throw new InviteEntryError("入口已过期", 410, "GONE");
  }

  return {
    eventId: row.eventId,
    phone: row.phone,
    mode: inviteEntryMode(row.phone),
    eventName: row.event.name,
    honorific: row.honorific,
    name: row.name,
    participantId: row.participantId,
    status: row.status,
  };
}

export async function markInviteEntryUsed(token: string): Promise<void> {
  await prisma.inviteEntry.updateMany({
    where: { token, status: InviteEntryStatus.PENDING },
    data: { status: InviteEntryStatus.USED, usedAt: new Date() },
  });
}

export async function listInviteEntriesForEvent(
  eventId: string,
  options?: { phone?: string; mode?: InviteEntryMode; limit?: number },
): Promise<InviteEntryDto[]> {
  const phone =
    options?.phone !== undefined
      ? resolveCreatePhone(options.phone)
      : undefined;
  const rows = await prisma.inviteEntry.findMany({
    where: {
      eventId,
      ...(options?.mode === "event"
        ? { phone: null }
        : options?.mode === "personal"
          ? { phone: { not: null } }
          : phone !== undefined
            ? { phone }
            : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options?.limit ?? 50, 1), 200),
  });
  return rows.map(toDto);
}
