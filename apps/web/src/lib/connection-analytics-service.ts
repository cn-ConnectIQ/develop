import {
  ConnectionSource,
  ConnectionStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

const SOURCE_LABELS: Record<ConnectionSource, string> = {
  [ConnectionSource.SCAN]: "扫码连接",
  [ConnectionSource.AI_RECOMMEND]: "AI 推荐促成",
  [ConnectionSource.SPEED_NETWORKING]: "Speed Networking",
  [ConnectionSource.REFERRAL]: "引荐连接",
};

export type ConnectionAnalyticsSummary = {
  totalConnections: number;
  wechatExchangeRate: number;
  aiMatchConnections: number;
  avgConnectionsPerCheckin: number;
  checkinCount: number;
  wechatExchangedCount: number;
};

export type HourlyConnectionPoint = {
  hour: string;
  count: number;
};

export type ConnectionSourceSlice = {
  name: string;
  value: number;
};

export type TopConnectorRow = {
  rank: number;
  userId: string;
  name: string;
  company: string;
  connectionCount: number;
  wechatExchangeCount: number;
};

export type BoothConnectionRow = {
  boothId: string;
  boothCode: string;
  companyName: string;
  connectionCount: number;
};

export type EventConnectionAnalytics = {
  summary: ConnectionAnalyticsSummary;
  hourlyTrend: HourlyConnectionPoint[];
  sourceBreakdown: ConnectionSourceSlice[];
  topConnectors: TopConnectorRow[];
  boothRankings: BoothConnectionRow[];
};

function resolveSourceLabel(
  source: ConnectionSource,
  boothId: string | null,
): string {
  if (boothId) return "展位连接";
  return SOURCE_LABELS[source] ?? source;
}

export async function getEventConnectionAnalytics(
  eventId: string,
): Promise<EventConnectionAnalytics> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const [connections, checkinCount] = await Promise.all([
    prisma.businessConnection.findMany({
      where: { eventId, status: ConnectionStatus.ACTIVE },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userAName: true,
        userBName: true,
        userACompany: true,
        userBCompany: true,
        source: true,
        fromAiMatch: true,
        wechatExchanged: true,
        createdAt: true,
        boothId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.checkIn.count({
      where: { eventId },
    }),
  ]);

  const totalConnections = connections.length;
  const wechatExchangedCount = connections.filter((c) => c.wechatExchanged).length;
  const aiMatchConnections = connections.filter((c) => c.fromAiMatch).length;
  const wechatExchangeRate =
    totalConnections > 0
      ? Math.round((wechatExchangedCount / totalConnections) * 1000) / 10
      : 0;
  const avgConnectionsPerCheckin =
    checkinCount > 0
      ? Math.round((totalConnections / checkinCount) * 10) / 10
      : 0;

  const hourlyMap = new Map<number, number>();
  for (const conn of connections) {
    const hour = new Date(conn.createdAt).getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
  }
  const hourlyTrend = [...hourlyMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      count,
    }));

  const sourceMap = new Map<string, number>();
  for (const conn of connections) {
    const label = resolveSourceLabel(conn.source, conn.boothId);
    sourceMap.set(label, (sourceMap.get(label) ?? 0) + 1);
  }
  const sourceBreakdown = [...sourceMap.entries()].map(([name, value]) => ({
    name,
    value,
  }));

  const userStats = new Map<
    string,
    { name: string; company: string; connections: number; wechat: number }
  >();
  for (const conn of connections) {
    const pairs: Array<[string | null, string, string | null]> = [
      [conn.userAId, conn.userAName, conn.userACompany],
      [conn.userBId, conn.userBName, conn.userBCompany],
    ];
    for (const [userId, name, company] of pairs) {
      if (!userId) continue;
      const existing = userStats.get(userId) ?? {
        name: name || "未知",
        company: company ?? "—",
        connections: 0,
        wechat: 0,
      };
      existing.connections += 1;
      if (conn.wechatExchanged) existing.wechat += 1;
      userStats.set(userId, existing);
    }
  }

  const topConnectors = [...userStats.entries()]
    .sort((a, b) => b[1].connections - a[1].connections)
    .slice(0, 10)
    .map(([userId, row], index) => ({
      rank: index + 1,
      userId,
      name: row.name,
      company: row.company,
      connectionCount: row.connections,
      wechatExchangeCount: row.wechat,
    }));

  const boothCountMap = new Map<string, number>();
  for (const conn of connections) {
    if (!conn.boothId) continue;
    boothCountMap.set(conn.boothId, (boothCountMap.get(conn.boothId) ?? 0) + 1);
  }

  const boothIds = [...boothCountMap.keys()];
  const booths =
    boothIds.length > 0
      ? await prisma.exhibitorBooth.findMany({
          where: { id: { in: boothIds } },
          select: {
            id: true,
            code: true,
            companyOrg: { select: { name: true } },
          },
        })
      : [];

  const boothRankings = booths
    .map((booth) => ({
      boothId: booth.id,
      boothCode: booth.code,
      companyName: booth.companyOrg.name,
      connectionCount: boothCountMap.get(booth.id) ?? 0,
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount);

  return {
    summary: {
      totalConnections,
      wechatExchangeRate,
      aiMatchConnections,
      avgConnectionsPerCheckin,
      checkinCount,
      wechatExchangedCount,
    },
    hourlyTrend,
    sourceBreakdown,
    topConnectors,
    boothRankings,
  };
}

export function connectionsToCsv(
  connections: Array<{
    userAName: string;
    userACompany: string | null;
    userBName: string;
    userBCompany: string | null;
    source: ConnectionSource;
    fromAiMatch: boolean;
    wechatExchanged: boolean;
    createdAt: Date;
    boothId: string | null;
  }>,
): string {
  const header = [
    "用户A",
    "A公司",
    "用户B",
    "B公司",
    "来源",
    "AI促成",
    "已交换微信",
    "建立时间",
  ].join(",");
  const rows = connections.map((c) =>
    [
      c.userAName,
      c.userACompany ?? "",
      c.userBName,
      c.userBCompany ?? "",
      resolveSourceLabel(c.source, c.boothId),
      c.fromAiMatch ? "是" : "否",
      c.wechatExchanged ? "是" : "否",
      c.createdAt.toISOString(),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return "\uFEFF" + [header, ...rows].join("\n");
}

export async function exportEventConnectionsCsv(eventId: string): Promise<string> {
  const connections = await prisma.businessConnection.findMany({
    where: { eventId, status: ConnectionStatus.ACTIVE },
    select: {
      userAName: true,
      userACompany: true,
      userBName: true,
      userBCompany: true,
      source: true,
      fromAiMatch: true,
      wechatExchanged: true,
      createdAt: true,
      boothId: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return connectionsToCsv(connections);
}
