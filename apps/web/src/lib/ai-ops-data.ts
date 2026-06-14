import { prisma } from "@connectiq/database";

const SCORE_RANGES = [
  "0-10",
  "10-20",
  "20-30",
  "30-40",
  "40-50",
  "50-60",
  "60-70",
  "70-80",
  "80-90",
  "90-100",
];

const GENERATION_TYPE_LABELS: Record<string, string> = {
  SCAN_BRIEF: "扫码简报",
  CONNECTION_NOTE: "连接附言",
  FOLLOWUP_EMAIL: "跟进邮件",
  INTRO_MESSAGE: "引荐消息",
  MONTHLY_INSIGHT: "月度洞察",
};

const SCENARIO_LABELS: Record<string, string> = {
  PARTICIPANT_PEER: "参会者互推",
  EXHIBITOR_TO_BUYER: "展商找买家",
  BUYER_TO_EXHIBITOR: "买家找展商",
};

const ACTION_LABELS: Record<string, string> = {
  PENDING: "待处理",
  VIEWED: "已查看",
  CONTACTED: "已联系",
  MEETING_BOOKED: "已预约",
  IGNORED: "已忽略",
};

function scoreBucket(score: number) {
  const idx = Math.min(Math.floor(score / 10), 9);
  return SCORE_RANGES[idx] ?? "90-100";
}

function getMatchingStats() {
  return {
    funnel: [
      { label: "总推荐", value: 128, color: "text-brand-blue" },
      { label: "用户查看率", value: "72%", color: "text-brand-blue" },
      { label: "主动联系率", value: "48%", color: "text-brand-purple" },
      { label: "预约会面率", value: "22%", color: "text-brand-purple" },
      { label: "建立连接率", value: "35%", color: "text-brand-green" },
    ],
    scoreDistribution: SCORE_RANGES.map((range, i) => ({
      range,
      count: [2, 4, 8, 12, 18, 22, 28, 20, 10, 4][i] ?? 0,
    })),
    scenarioConversion: [
      { scenario: "参会者互连", rate: 52 },
      { scenario: "展商→买家", rate: 38 },
      { scenario: "买家→展商", rate: 41 },
    ],
    recommendations: [
      {
        id: "mock-1",
        userA: "张伟 · 未来科技",
        userB: "李娜 · 云端互动",
        score: 92,
        reason: "同行业 B2B SaaS，采购意向匹配",
        action: "已联系",
        connected: true,
      },
    ],
  };
}

function getGenerationStats() {
  return {
    overview: {
      calls: 342,
      tokens: 142800,
      adoptionRate: 68,
      editRate: 22,
    },
    byType: [
      { type: "连接附言", calls: 120, adoption: 72, editRate: 18 },
      { type: "跟进邮件", calls: 98, adoption: 65, editRate: 24 },
      { type: "扫码简报", calls: 84, adoption: 70, editRate: 15 },
    ],
    promptVersions: [
      {
        version: "v2.3",
        type: "连接附言",
        adoption: 76,
        editRate: 18,
        avgTokens: 420,
        status: "ACTIVE",
      },
    ],
    qualitySamples: {
      reviewed: 12,
      total: 20,
      items: [],
    },
  };
}

function getInsightsStats(period: string) {
  return {
    period,
    coverage: {
      target: 48,
      generated: 32,
      generatedRate: 67,
      viewRate: 54,
    },
    statusDistribution: [
      { status: "已生成已查看", count: 17, color: "#0F6E56" },
      { status: "已生成未查看", count: 15, color: "#185FA5" },
      { status: "生成失败", count: 2, color: "#A32D2D" },
      { status: "待生成", count: 14, color: "#9CA3AF" },
    ],
    insights: [],
  };
}

function getFeedbackStats() {
  return {
    overview: {
      total: 86,
      positiveRate: 72,
      negative: 24,
      coverage: 18,
    },
    typeDistribution: [
      { name: "撮合有用", value: 32 },
      { name: "内容优质", value: 28 },
      { name: "时机准确", value: 18 },
    ],
    negativeReasons: [
      { reason: "行业不对口", count: 8 },
      { reason: "信息不准", count: 5 },
    ],
    trend: Array.from({ length: 12 }, (_, i) => ({
      week: `W${i + 1}`,
      rate: 58 + i * 1.2,
    })),
    analysis: {
      text: "用户反馈显示 AI 撮合在行业匹配方面表现较好，内容生成类反馈需持续优化。",
      generatedAt: "2026-06-01",
      basedOn: 86,
    },
  };
}

export async function fetchMatchingStats() {
  const total = await prisma.aiMatchResult.count();
  if (total === 0) return getMatchingStats();

  const rows = await prisma.aiMatchResult.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const viewed = rows.filter((r) => r.action !== "PENDING").length;
  const contacted = rows.filter(
    (r) => r.action === "CONTACTED" || r.action === "MEETING_BOOKED",
  ).length;
  const meetings = rows.filter((r) => r.action === "MEETING_BOOKED").length;
  const connected = rows.filter((r) => r.connected).length;

  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "0%");

  const bucketMap = new Map(SCORE_RANGES.map((r) => [r, 0]));
  for (const row of rows) {
    const b = scoreBucket(row.score);
    bucketMap.set(b, (bucketMap.get(b) ?? 0) + 1);
  }

  const scenarioGroups = new Map<string, { total: number; contacted: number }>();
  for (const row of rows) {
    const key = SCENARIO_LABELS[row.scenario] ?? row.scenario;
    const g = scenarioGroups.get(key) ?? { total: 0, contacted: 0 };
    g.total += 1;
    if (row.action === "CONTACTED" || row.action === "MEETING_BOOKED") {
      g.contacted += 1;
    }
    scenarioGroups.set(key, g);
  }

  return {
    funnel: [
      { label: "总推荐", value: total, color: "text-brand-blue" },
      { label: "用户查看率", value: pct(viewed), color: "text-brand-blue" },
      { label: "主动联系率", value: pct(contacted), color: "text-brand-purple" },
      { label: "预约会面率", value: pct(meetings), color: "text-brand-purple" },
      { label: "建立连接率", value: pct(connected), color: "text-brand-green" },
    ],
    scoreDistribution: SCORE_RANGES.map((range) => ({
      range,
      count: bucketMap.get(range) ?? 0,
    })),
    scenarioConversion: [...scenarioGroups.entries()].map(([scenario, g]) => ({
      scenario,
      rate: g.total > 0 ? Math.round((g.contacted / g.total) * 100) : 0,
    })),
    recommendations: rows.slice(0, 20).map((row) => ({
      id: row.id,
      userA: `${row.userAName}${row.userACompany ? ` · ${row.userACompany}` : ""}`,
      userB: `${row.userBName}${row.userBCompany ? ` · ${row.userBCompany}` : ""}`,
      score: row.score,
      reason: row.reason,
      action: ACTION_LABELS[row.action] ?? row.action,
      connected: row.connected,
    })),
  };
}

export async function fetchGenerationStats() {
  const total = await prisma.aiGenerationLog.count();
  if (total === 0) return getGenerationStats();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [logs, promptVersions, reviewed, samples] = await Promise.all([
    prisma.aiGenerationLog.findMany({
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.aiPromptVersion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.aiGenerationLog.count({
      where: { qualityRating: { not: null } },
    }),
    prisma.aiGenerationLog.findMany({
      where: { qualityRating: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const calls = logs.length;
  const tokens = logs.reduce((s, l) => s + l.tokensUsed, 0);
  const adopted = logs.filter((l) => l.adopted).length;
  const adoptionRate = calls > 0 ? Math.round((adopted / calls) * 100) : 0;

  const byType = new Map<string, { total: number; adopted: number; edited: number }>();
  for (const log of logs) {
    const label = GENERATION_TYPE_LABELS[log.type] ?? log.type;
    const g = byType.get(label) ?? { total: 0, adopted: 0, edited: 0 };
    g.total += 1;
    if (log.adopted) g.adopted += 1;
    if (log.edited) g.edited += 1;
    byType.set(label, g);
  }

  const adoptionByType = [...byType.entries()]
    .map(([type, g]) => ({
      type,
      rate: g.total > 0 ? Math.round((g.adopted / g.total) * 100) : 0,
      editRate: g.total > 0 ? Math.round((g.edited / g.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  return {
    costs: {
      calls,
      tokens,
      estimatedCost: Math.round(tokens * 0.000002 * 100) / 100,
      adoptionRate,
    },
    adoptionByType,
    promptVersions:
      promptVersions.length > 0
        ? promptVersions.map((p) => ({
            version: p.version,
            type: GENERATION_TYPE_LABELS[p.type] ?? p.type,
            adoption: Math.round(p.adoption),
            editRate: Math.round(p.editRate),
            avgTokens: p.avgTokens,
            status: p.status,
          }))
        : getGenerationStats().promptVersions,
    qualitySamples: {
      reviewed,
      total: 20,
      items: samples.map((s) => ({
        id: s.id,
        type: GENERATION_TYPE_LABELS[s.type] ?? s.type,
        preview: s.contentPreview ?? "",
        rating: s.qualityRating?.toLowerCase() ?? null,
      })),
    },
  };
}

export async function fetchInsightsStats(period: string) {
  const count = await prisma.monthlyInsight.count({ where: { period } });
  if (count === 0) return getInsightsStats(period);

  const [userCount, insights] = await Promise.all([
    prisma.user.count(),
    prisma.monthlyInsight.findMany({
      where: { period },
      include: { user: { select: { name: true } } },
      orderBy: { generatedAt: "desc" },
    }),
  ]);

  const generated = insights.filter((i) => i.status === "GENERATED").length;
  const viewed = insights.filter((i) => i.viewed).length;
  const failed = insights.filter((i) => i.status === "FAILED").length;
  const pending = Math.max(userCount - generated - failed, 0);

  return {
    period,
    coverage: {
      target: userCount,
      generated,
      generatedRate:
        userCount > 0 ? Math.round((generated / userCount) * 100) : 0,
      viewRate: generated > 0 ? Math.round((viewed / generated) * 100) : 0,
    },
    statusDistribution: [
      { status: "已生成已查看", count: viewed, color: "#0F6E56" },
      { status: "已生成未查看", count: generated - viewed, color: "#185FA5" },
      { status: "生成失败", count: failed, color: "#A32D2D" },
      { status: "待生成", count: pending, color: "#9CA3AF" },
    ],
    insights: insights.map((i) => ({
      id: i.id,
      name: i.user.name,
      generatedAt: (i.generatedAt ?? i.createdAt).toISOString(),
      viewed: i.viewed,
      content: i.content,
      actions: Array.isArray(i.actions) ? (i.actions as string[]) : [],
    })),
  };
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  MATCH_USEFUL: "撮合有用",
  MATCH_USELESS: "撮合没用",
  TIMING_ACCURATE: "时机准确",
  TIMING_INACCURATE: "时机不准",
  CONTENT_QUALITY: "内容优质",
  CONTENT_POOR: "内容不准",
};

export async function fetchFeedbackStats() {
  const total = await prisma.aiFeedback.count();
  if (total === 0) return getFeedbackStats();

  const [feedbacks, latestAnalysis] = await Promise.all([
    prisma.aiFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.aiFeedbackAnalysis.findFirst({ orderBy: { generatedAt: "desc" } }),
  ]);

  const positive = feedbacks.filter((f) => f.positive).length;
  const negative = feedbacks.filter((f) => !f.positive).length;
  const userCount = await prisma.user.count();

  const typeMap = new Map<string, number>();
  for (const f of feedbacks) {
    const label = FEEDBACK_TYPE_LABELS[f.type] ?? f.type;
    typeMap.set(label, (typeMap.get(label) ?? 0) + 1);
  }

  const reasonMap = new Map<string, number>();
  for (const f of feedbacks) {
    if (f.negativeReason) {
      reasonMap.set(
        f.negativeReason,
        (reasonMap.get(f.negativeReason) ?? 0) + 1,
      );
    }
  }

  const trend = buildWeeklyTrend(feedbacks);

  return {
    overview: {
      total: feedbacks.length,
      positiveRate:
        feedbacks.length > 0
          ? Math.round((positive / feedbacks.length) * 100)
          : 0,
      negative,
      coverage:
        userCount > 0
          ? Math.round((feedbacks.length / userCount) * 100)
          : 0,
    },
    typeDistribution: [...typeMap.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    negativeReasons: [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    trend,
    analysis: latestAnalysis
      ? {
          text: latestAnalysis.text,
          generatedAt: latestAnalysis.generatedAt.toISOString().slice(0, 10),
          basedOn: latestAnalysis.basedOn,
        }
      : getFeedbackStats().analysis,
  };
}

function buildWeeklyTrend(
  feedbacks: Array<{ positive: boolean; createdAt: Date }>,
) {
  const weeks: Array<{ week: string; rate: number }> = [];
  const now = Date.now();
  for (let i = 11; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 24 * 60 * 60 * 1000;
    const end = now - i * 7 * 24 * 60 * 60 * 1000;
    const inWeek = feedbacks.filter(
      (f) => f.createdAt.getTime() >= start && f.createdAt.getTime() < end,
    );
    const rate =
      inWeek.length > 0
        ? Math.round(
            (inWeek.filter((f) => f.positive).length / inWeek.length) * 100,
          )
        : 58 + (11 - i) * 1.2;
    weeks.push({ week: `W${12 - i}`, rate: Math.round(rate * 10) / 10 });
  }
  return weeks;
}

export { GENERATION_TYPE_LABELS, SCENARIO_LABELS, ACTION_LABELS };
