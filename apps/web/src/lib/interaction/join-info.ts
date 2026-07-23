import { prisma } from "@connectiq/database";
import { getInteractionScanUrl } from "@/lib/qrcode";
import { resolveInteractionWxacodeImageUrl } from "@/lib/wechat/wxacode-image";

type InteractionJoinInfo = {
  sessionCode: string;
  scanUrl: string;
  qrUrl: string | null;
  /** 微信小程序码图（优先展示） */
  wxacodeUrl: string | null;
};

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
