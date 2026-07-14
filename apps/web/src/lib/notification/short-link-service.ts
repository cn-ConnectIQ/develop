import { ShortLinkScene, prisma } from "@connectiq/database";
import { generateOpaqueToken } from "@/lib/notification/crypto";

const SCENE_MAP: Record<string, ShortLinkScene> = {
  a: ShortLinkScene.A,
  b: ShortLinkScene.B,
  o: ShortLinkScene.O,
  j: ShortLinkScene.J,
};

export function sceneToPath(scene: ShortLinkScene): string {
  return scene.toLowerCase();
}

export function parseSceneParam(raw: string): ShortLinkScene | null {
  return SCENE_MAP[raw.toLowerCase()] ?? null;
}

/** 短链公网前缀：优先 SHORT_LINK_BASE，否则 9li.co 根域 */
export function getShortLinkBase(): string {
  return (
    process.env.SHORT_LINK_BASE?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SHORT_LINK_BASE?.replace(/\/$/, "") ||
    "https://9li.co"
  );
}

export async function createShortLink(input: {
  scene: ShortLinkScene;
  targetUrl: string;
  eventId?: string | null;
  userId?: string | null;
  /** 默认 30 天 */
  expiresInDays?: number;
}): Promise<{ id: string; token: string; url: string }> {
  if (!/^https:\/\//i.test(input.targetUrl)) {
    throw new Error("短链目标必须是 https URL");
  }

  const token = generateOpaqueToken(12);
  const expiresAt = new Date(
    Date.now() + (input.expiresInDays ?? 30) * 24 * 60 * 60 * 1000,
  );

  const row = await prisma.shortLink.create({
    data: {
      token,
      scene: input.scene,
      targetUrl: input.targetUrl,
      eventId: input.eventId ?? undefined,
      userId: input.userId ?? undefined,
      expiresAt,
    },
  });

  const url = `${getShortLinkBase()}/${sceneToPath(row.scene)}/${row.token}`;
  return { id: row.id, token: row.token, url };
}

export async function resolveAndClickShortLink(token: string) {
  const row = await prisma.shortLink.findUnique({ where: { token } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return { expired: true as const, row };

  const now = new Date();
  await prisma.$transaction([
    prisma.shortLink.update({
      where: { id: row.id },
      data: { clickedAt: row.clickedAt ?? now },
    }),
    prisma.notificationRecord.updateMany({
      where: { shortLinkId: row.id, clickedAt: null },
      data: { clickedAt: now },
    }),
  ]);

  return { expired: false as const, row };
}

export async function markShortLinkConverted(tokenOrRecordId: {
  token?: string;
  recordId?: string;
  shortLinkId?: string;
}) {
  const now = new Date();
  let shortLinkId = tokenOrRecordId.shortLinkId;

  if (!shortLinkId && tokenOrRecordId.token) {
    const link = await prisma.shortLink.findUnique({
      where: { token: tokenOrRecordId.token },
      select: { id: true },
    });
    shortLinkId = link?.id;
  }

  if (!shortLinkId && tokenOrRecordId.recordId) {
    const rec = await prisma.notificationRecord.findUnique({
      where: { id: tokenOrRecordId.recordId },
      select: { shortLinkId: true },
    });
    shortLinkId = rec?.shortLinkId ?? undefined;
  }

  if (!shortLinkId) return;

  await prisma.$transaction([
    prisma.shortLink.update({
      where: { id: shortLinkId },
      data: { convertedAt: now },
    }),
    prisma.notificationRecord.updateMany({
      where: { shortLinkId, convertedAt: null },
      data: { convertedAt: now },
    }),
  ]);
}
