import {
  adjustUserPoints,
  disconnectBusinessConnection,
  fetchPlatformConnections,
  fetchPlatformOverviewStats,
  fetchPlatformPointsStats,
  fetchPlatformUserDetail,
  fetchPlatformUsers,
} from "@/lib/platform-service";

export async function getPlatformOverviewStats() {
  return fetchPlatformOverviewStats();
}

export async function getPlatformUsers(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return fetchPlatformUsers(params);
}

export async function getPlatformUserDetail(userId: string) {
  return fetchPlatformUserDetail(userId);
}

export async function getPlatformConnections(params?: {
  eventId?: string;
  source?: string;
  status?: string;
}) {
  const data = await fetchPlatformConnections(params);
  if (data) return data;
  return getPlatformConnectionsFallback();
}

export async function getPlatformPointsStats() {
  const data = await fetchPlatformPointsStats();
  if (data) return data;
  return getPlatformPointsStatsFallback();
}

export async function adjustPlatformPoints(
  userId: string,
  amount: number,
  reason: string,
) {
  await adjustUserPoints(userId, amount, reason);
}

export async function deletePlatformConnection(connectionId: string) {
  await disconnectBusinessConnection(connectionId);
}

function getPlatformConnectionsFallback() {
  return {
    health: {
      total: 87,
      monthlyNew: 23,
      activeRate: 68,
      aiRate: 42,
      avgDepth: 2.4,
    },
    sourceTrend: Array.from({ length: 6 }, (_, i) => ({
      month: `${i + 1}月`,
      扫码: 20 + i * 3,
      AI推荐: 15 + i * 4,
      SN: 8 + i * 2,
      引荐: 5 + i,
    })),
    originContext: [
      { name: "展位扫码", value: 42 },
      { name: "AI 撮合", value: 28 },
      { name: "SN 配对", value: 18 },
      { name: "主动引荐", value: 12 },
    ],
    connections: [
      {
        id: "mock-1",
        userA: { name: "张伟", company: "未来科技" },
        userB: { name: "李娜", company: "云端互动" },
        source: "AI 推荐",
        event: "ConnectIQ 峰会 2026",
        depth: 4,
        aiScore: 92,
        createdAt: new Date().toISOString(),
        status: "ACTIVE",
        interactions: [
          { time: new Date().toISOString(), type: "event", desc: "同场活动认识" },
          { time: new Date().toISOString(), type: "message", desc: "发送跟进消息" },
        ],
      },
    ],
  };
}

function getPlatformPointsStatsFallback() {
  return {
    stats: {
      totalCirculation: 42500,
      monthlyIssued: 8400,
      monthlySpent: 3200,
      activeUsers: 48,
    },
    sources: [
      { reason: "签到奖励", count: 4200 },
      { reason: "建立连接", count: 3800 },
      { reason: "互动参与", count: 2100 },
      { reason: "完善资料", count: 1500 },
      { reason: "邀请好友", count: 980 },
    ],
    redemptions: [
      { name: "VIP 议程", value: 35 },
      { name: "优先撮合", value: 28 },
      { name: "展位优惠券", value: 22 },
      { name: "其他", value: 15 },
    ],
    topUsers: Array.from({ length: 20 }, (_, i) => ({
      rank: i + 1,
      name: ["张伟", "李娜", "王强", "陈静", "刘洋"][i % 5],
      company: ["未来科技", "云端互动", "智联会展"][i % 3],
      monthly: 320 - i * 12,
      balance: 1580 - i * 40,
      source: ["签到奖励", "建立连接", "互动参与"][i % 3],
    })),
    suspicious: [
      {
        userId: "susp1",
        name: "异常用户 A",
        reason: "单日积分异常增长",
        points: 5000,
      },
    ],
  };
}
