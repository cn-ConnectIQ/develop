import {
  ConnectionStatus,
  ExchangeStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiEventConnectionPeer = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
};

export type ApiEventConnectionItem = {
  connection_id: string;
  peer: ApiEventConnectionPeer;
  connected_at: string;
  location?: string;
  wechat_exchanged: boolean;
  exchange_pending: boolean;
  peer_wechat_qr_url?: string;
  peer_phone?: string;
  peer_email?: string;
  peer_wechat_id?: string;
};

export type ApiEventMyConnections = {
  count: number;
  wechat_count: number;
  items: ApiEventConnectionItem[];
};

export async function listEventMyConnections(
  viewerId: string,
  eventId: string,
): Promise<ApiEventMyConnections> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, location: true },
  });

  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const defaultLocation = event.location ?? event.name;

  const rows = await prisma.businessConnection.findMany({
    where: {
      eventId,
      status: ConnectionStatus.ACTIVE,
      OR: [{ userAId: viewerId }, { userBId: viewerId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      userA: {
        select: {
          id: true,
          name: true,
          phone: true,
          profile: { select: { company: true, valueProposition: true } },
          contactCard: {
            select: {
              wechatQrUrl: true,
              wechatId: true,
              showPhone: true,
              showEmail: true,
              email: true,
            },
          },
        },
      },
      userB: {
        select: {
          id: true,
          name: true,
          phone: true,
          profile: { select: { company: true, valueProposition: true } },
          contactCard: {
            select: {
              wechatQrUrl: true,
              wechatId: true,
              showPhone: true,
              showEmail: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const pendingRequests = await prisma.exchangeRequest.findMany({
    where: {
      eventId,
      fromUserId: viewerId,
      status: ExchangeStatus.PENDING,
    },
    select: { toUserId: true },
  });
  const pendingPeerIds = new Set(pendingRequests.map((r) => r.toUserId));

  const items: ApiEventConnectionItem[] = rows.map((row) => {
    const isViewerA = row.userAId === viewerId;
    const peerUser = isViewerA ? row.userB : row.userA;
    const peerId = isViewerA ? row.userBId : row.userAId;
    const peerName = isViewerA ? row.userBName : row.userAName;
    const peerCompany = isViewerA ? row.userBCompany : row.userACompany;
    const card = peerUser?.contactCard;

    return {
      connection_id: row.id,
      peer: {
        id: peerId ?? peerUser?.id ?? "",
        name: peerName,
        company: peerCompany ?? peerUser?.profile?.company ?? undefined,
        title: peerUser?.profile?.valueProposition ?? undefined,
      },
      connected_at: row.createdAt.toISOString(),
      location: row.originContext ?? defaultLocation,
      wechat_exchanged: row.wechatExchanged,
      exchange_pending: peerId ? pendingPeerIds.has(peerId) : false,
      peer_wechat_qr_url:
        row.wechatExchanged && card?.wechatQrUrl ? card.wechatQrUrl : undefined,
      peer_phone:
        row.wechatExchanged && card?.showPhone && peerUser?.phone
          ? peerUser.phone
          : undefined,
      peer_email:
        row.wechatExchanged && card?.showEmail && card?.email
          ? card.email
          : undefined,
      peer_wechat_id:
        row.wechatExchanged && card?.wechatId ? card.wechatId : undefined,
    };
  });

  const wechatCount = items.filter((item) => item.wechat_exchanged).length;

  return {
    count: items.length,
    wechat_count: wechatCount,
    items,
  };
}
