import { ConnectionStatus, prisma } from "@connectiq/database";

type ConnectionWhereExtra = {
  wechatExchanged?: boolean;
};

/** 活动维度连接范围（含展位现场连接 eventId 为空的历史数据） */
export async function buildUserEventConnectionWhere(
  eventId: string,
  userId: string,
  extra?: ConnectionWhereExtra,
) {
  const eventBooths = await prisma.exhibitorBooth.findMany({
    where: { eventId },
    select: { id: true },
  });
  const eventBoothIds = eventBooths.map((booth) => booth.id);

  return {
    status: ConnectionStatus.ACTIVE,
    ...(extra?.wechatExchanged !== undefined
      ? { wechatExchanged: extra.wechatExchanged }
      : {}),
    AND: [
      { OR: [{ userAId: userId }, { userBId: userId }] },
      {
        OR: [
          { eventId },
          ...(eventBoothIds.length > 0
            ? [{ eventId: null, boothId: { in: eventBoothIds } }]
            : []),
        ],
      },
    ],
  };
}
