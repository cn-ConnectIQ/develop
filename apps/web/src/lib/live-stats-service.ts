import { ConnectionStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getBoothRankings } from "@/lib/booth-rankings-service";
import { calcCheckinRate } from "@/lib/checkin";
import { LIVE_STATS_REALTIME_TABLES } from "@/lib/realtime/channels";

export type ApiLiveStatsBoothHeat = {
  boothId: string;
  boothNumber: string;
  companyName: string;
  todayVisitors: number;
  change: number;
  rank: number;
};

export type ApiEventLiveStats = {
  checkinRate: number;
  onsite: number;
  connections: number;
  interactions: number;
  boothHeat: ApiLiveStatsBoothHeat[];
  /** 供前端判断是否启用 Realtime */
  realtime: {
    enabled: boolean;
    tables: readonly string[];
    pollIntervalMs: number;
  };
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getEventLiveStats(eventId: string): Promise<ApiEventLiveStats> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const todayStart = startOfToday();

  const [
    participantTotal,
    checkedIn,
    connections,
    interactions,
    boothRankings,
  ] = await Promise.all([
    prisma.participant.count({ where: { eventId } }),
    prisma.checkIn.count({ where: { eventId } }),
    prisma.businessConnection.count({
      where: { eventId, status: ConnectionStatus.ACTIVE },
    }),
    prisma.pollResponse.count({
      where: {
        poll: { eventId },
        createdAt: { gte: todayStart },
      },
    }),
    getBoothRankings(eventId),
  ]);

  const boothHeat: ApiLiveStatsBoothHeat[] = boothRankings.rankings
    .slice(0, 10)
    .map((b) => ({
      boothId: b.booth_id,
      boothNumber: b.booth_number,
      companyName: b.company_name,
      todayVisitors: b.today_visitors,
      change: b.change,
      rank: b.rank,
    }));

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return {
    checkinRate: calcCheckinRate(checkedIn, participantTotal),
    onsite: checkedIn,
    connections,
    interactions,
    boothHeat,
    realtime: {
      enabled: supabaseConfigured,
      tables: LIVE_STATS_REALTIME_TABLES,
      pollIntervalMs: 15_000,
    },
  };
}
