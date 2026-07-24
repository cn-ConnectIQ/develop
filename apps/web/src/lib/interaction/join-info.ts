import {
  LotteryCategory,
  LotteryOwnerType,
  LotteryStatus,
  prisma,
} from "@connectiq/database";
import { getInteractionScanUrl } from "@/lib/qrcode";
import { createInteractionSession } from "@/lib/interaction/session-service";
import { resolveInteractionWxacodeImageUrl } from "@/lib/wechat/wxacode-image";

export type InteractionJoinInfo = {
  sessionCode: string;
  scanUrl: string;
  qrUrl: string | null;
  /** 微信小程序码图（优先展示） */
  wxacodeUrl: string | null;
};

const PARTICIPANT_CATEGORIES: LotteryCategory[] = [
  LotteryCategory.AUTO_PROBABILITY,
  LotteryCategory.INSTANT_CLAIM,
];

const JOINABLE_STATUSES: LotteryStatus[] = [
  LotteryStatus.ACTIVE,
  LotteryStatus.OPEN,
  LotteryStatus.DRAWING,
  LotteryStatus.READY,
];

function refsContain(
  interactions: unknown,
  kind: "poll" | "lottery",
  id: string,
): boolean {
  if (!Array.isArray(interactions)) return false;
  return interactions.some((item) => {
    if (!item || typeof item !== "object") return false;
    const ref = item as { type?: unknown; id?: unknown };
    const type =
      typeof ref.type === "string" ? ref.type.toLowerCase() : "";
    return type === kind && ref.id === id;
  });
}

/** 按投票/抽奖 ID 查找对应互动会话的扫码入口 */
export async function findInteractionJoinInfo(input: {
  eventId: string;
  pollId?: string | null;
  lotteryId?: string | null;
  /** 默认尝试生成小程序码 */
  includeWxacode?: boolean;
}): Promise<InteractionJoinInfo | null> {
  const sessions = await prisma.interactionSession.findMany({
    where: { eventId: input.eventId, isActive: true },
    select: { sessionCode: true, qrUrl: true, interactions: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  let matched: { sessionCode: string; qrUrl: string | null } | null = null;

  for (const session of sessions) {
    if (
      input.pollId &&
      refsContain(session.interactions, "poll", input.pollId)
    ) {
      matched = { sessionCode: session.sessionCode, qrUrl: session.qrUrl };
      break;
    }
    if (
      input.lotteryId &&
      refsContain(session.interactions, "lottery", input.lotteryId)
    ) {
      matched = { sessionCode: session.sessionCode, qrUrl: session.qrUrl };
      break;
    }
  }

  if (!matched) return null;

  const wxacodeUrl =
    input.includeWxacode === false
      ? null
      : await resolveInteractionWxacodeImageUrl(matched.sessionCode);

  return {
    sessionCode: matched.sessionCode,
    scanUrl: getInteractionScanUrl(matched.sessionCode),
    qrUrl: matched.qrUrl,
    wxacodeUrl,
  };
}

/**
 * 参与人抽奖（概率 / 直接领取）若尚无互动会话，则补建扫码入口。
 * 大屏抽奖（POOL_DRAW）仍走 allow_scan_join 专用链路，此处不创建。
 */
export async function ensureParticipantLotteryJoinInfo(input: {
  eventId: string;
  lotteryId: string;
  includeWxacode?: boolean;
}): Promise<InteractionJoinInfo | null> {
  const existing = await findInteractionJoinInfo(input);
  if (existing) return existing;

  const lottery = await prisma.lottery.findFirst({
    where: { id: input.lotteryId, eventId: input.eventId },
    select: {
      id: true,
      title: true,
      createdById: true,
      ownerType: true,
      boothId: true,
      lotteryCategory: true,
      status: true,
      booth: { select: { companyOrgId: true } },
    },
  });
  if (!lottery?.lotteryCategory) return null;
  if (!PARTICIPANT_CATEGORIES.includes(lottery.lotteryCategory)) return null;
  if (!JOINABLE_STATUSES.includes(lottery.status)) return null;

  const session = await createInteractionSession({
    eventId: input.eventId,
    createdById: lottery.createdById,
    name: lottery.title,
    interactions: [{ type: "lottery", id: lottery.id }],
    boothId: lottery.boothId,
    exhibitorOrgId: lottery.booth?.companyOrgId ?? null,
    ownerType:
      lottery.ownerType === LotteryOwnerType.EXHIBITOR
        ? "EXHIBITOR"
        : "ORGANIZER",
    settings: {
      lotteryCategory: lottery.lotteryCategory,
    },
  });

  const wxacodeUrl =
    input.includeWxacode === false
      ? null
      : await resolveInteractionWxacodeImageUrl(session.sessionCode);

  return {
    sessionCode: session.sessionCode,
    scanUrl: getInteractionScanUrl(session.sessionCode),
    qrUrl: session.qrUrl,
    wxacodeUrl,
  };
}

/** 查找或（参与人抽奖）补建扫码入口 */
export async function resolveLotteryJoinInfo(input: {
  eventId: string;
  lotteryId: string;
  includeWxacode?: boolean;
}): Promise<InteractionJoinInfo | null> {
  const found = await findInteractionJoinInfo(input);
  if (found) return found;
  return ensureParticipantLotteryJoinInfo(input);
}
