import { SignalType, prisma } from "@connectiq/database";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  BOOTH_SCAN: "扫描展位",
  BOOTH_LEAD_CAPTURED: "展位留资",
  POLL_ANSWERED: "参与投票",
  QNA_ASKED: "Q&A 提问",
  QNA_UPVOTED: "Q&A 点赞",
  INTERACTION_JOINED: "参与互动",
  CONNECTION_MADE: "建立连接",
  MEETING_BOOKED: "预约会面",
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function resolveSignalDescription(
  signal: {
    signalType: SignalType;
    entityId: string | null;
    payload: unknown;
  },
  userName: string,
) {
  const payload =
    signal.payload && typeof signal.payload === "object"
      ? (signal.payload as Record<string, unknown>)
      : {};

  switch (signal.signalType) {
    case SignalType.BOOTH_SCAN: {
      if (signal.entityId) {
        const booth = await prisma.exhibitorBooth.findUnique({
          where: { id: signal.entityId },
          select: { name: true, code: true },
        });
        if (booth) {
          return `${userName} 扫描了 ${booth.code ?? ""} ${booth.name} 展位`.trim();
        }
      }
      return `${userName} 扫描了展位`;
    }
    case SignalType.BOOTH_LEAD_CAPTURED:
      return `${userName} 在展位留下了联系方式`;
    case SignalType.POLL_ANSWERED: {
      const options = payload.selected_options;
      if (Array.isArray(options) && options[0]) {
        return `${userName} 在投票中选择了「${options[0]}」`;
      }
      return `${userName} 参与了投票`;
    }
    case SignalType.QNA_ASKED: {
      const q = payload.question_text;
      if (typeof q === "string" && q.trim()) {
        return `${userName} 在 Q&A 提问：${q.trim().slice(0, 40)}${q.length > 40 ? "…" : ""}`;
      }
      return `${userName} 在 Q&A 中提问`;
    }
    case SignalType.QNA_UPVOTED:
      return `${userName} 点赞了 Q&A 问题`;
    case SignalType.INTERACTION_JOINED:
      return `${userName} 参与了现场互动`;
    case SignalType.CONNECTION_MADE:
      return `${userName} 建立了新连接`;
    case SignalType.MEETING_BOOKED:
      return `${userName} 预约了会面`;
    default:
      return `${userName} ${SIGNAL_TYPE_LABELS[signal.signalType] ?? "产生行为信号"}`;
  }
}

export async function fetchSignalStats() {
  const todayStart = startOfToday();

  const [totalToday, boothScan, pollAnswered, qnaAsked, recentRows] =
    await Promise.all([
      prisma.boothVisitSignal.count({
        where: { occurredAt: { gte: todayStart } },
      }),
      prisma.boothVisitSignal.count({
        where: {
          occurredAt: { gte: todayStart },
          signalType: SignalType.BOOTH_SCAN,
        },
      }),
      prisma.boothVisitSignal.count({
        where: {
          occurredAt: { gte: todayStart },
          signalType: SignalType.POLL_ANSWERED,
        },
      }),
      prisma.boothVisitSignal.count({
        where: {
          occurredAt: { gte: todayStart },
          signalType: SignalType.QNA_ASKED,
        },
      }),
      prisma.boothVisitSignal.findMany({
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profile: { select: { company: true } },
            },
          },
        },
      }),
    ]);

  const recent = await Promise.all(
    recentRows.map(async (row) => ({
      id: row.id,
      user: {
        id: row.user.id,
        name: row.user.name,
        company: row.user.profile?.company ?? undefined,
      },
      signal_type: row.signalType,
      description: await resolveSignalDescription(row, row.user.name),
      occurred_at: format(row.occurredAt, "M月d日 HH:mm", { locale: zhCN }),
    })),
  );

  return {
    stats: {
      totalToday,
      boothScan,
      pollAnswered,
      qnaAsked,
    },
    recent,
  };
}

export { SIGNAL_TYPE_LABELS };
