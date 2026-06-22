import { SignalType, prisma } from "@connectiq/database";

export type BoothRankingItem = {
  booth_id: string;
  booth_number: string;
  company_name: string;
  org_id: string;
  today_visitors: number;
  total_visitors: number;
  rank: number;
  change: number;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getBoothRankings(eventId: string): Promise<{
  event_name: string;
  rankings: BoothRankingItem[];
}> {
  const since30m = new Date(Date.now() - 30 * 60 * 1000);
  const todayStart = startOfToday();

  const [event, booths, leads, scans] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    }),
    prisma.exhibitorBooth.findMany({
      where: { eventId },
      select: {
        id: true,
        code: true,
        companyOrgId: true,
        companyOrg: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({
      where: { booth: { eventId } },
      select: { boothId: true, createdAt: true },
    }),
    prisma.boothVisitSignal.findMany({
      where: {
        eventId,
        signalType: SignalType.BOOTH_SCAN,
        entityId: { not: null },
      },
      select: { entityId: true, occurredAt: true },
    }),
  ]);

  if (!event) {
    return { event_name: "", rankings: [] };
  }

  type BoothAgg = {
    leadTotal: number;
    leadToday: number;
    leadRecent: number;
    scanTotal: number;
    scanToday: number;
    scanRecent: number;
  };

  const agg = new Map<string, BoothAgg>();
  const ensure = (boothId: string): BoothAgg => {
    const existing = agg.get(boothId);
    if (existing) return existing;
    const row: BoothAgg = {
      leadTotal: 0,
      leadToday: 0,
      leadRecent: 0,
      scanTotal: 0,
      scanToday: 0,
      scanRecent: 0,
    };
    agg.set(boothId, row);
    return row;
  };

  for (const booth of booths) {
    ensure(booth.id);
  }

  for (const lead of leads) {
    const row = ensure(lead.boothId);
    row.leadTotal += 1;
    if (lead.createdAt >= todayStart) row.leadToday += 1;
    if (lead.createdAt >= since30m) row.leadRecent += 1;
  }

  for (const scan of scans) {
    if (!scan.entityId) continue;
    const row = ensure(scan.entityId);
    row.scanTotal += 1;
    if (scan.occurredAt >= todayStart) row.scanToday += 1;
    if (scan.occurredAt >= since30m) row.scanRecent += 1;
  }

  const ranked = booths
    .map((booth) => {
      const stats = agg.get(booth.id)!;
      const todayVisitors = Math.max(stats.leadToday, stats.scanToday);
      const totalVisitors = Math.max(stats.leadTotal, stats.scanTotal);
      const change = Math.max(stats.leadRecent, stats.scanRecent);
      return {
        booth_id: booth.id,
        booth_number: booth.code,
        company_name: booth.companyOrg.name,
        org_id: booth.companyOrgId,
        today_visitors: todayVisitors,
        total_visitors: totalVisitors,
        rank: 0,
        change,
      };
    })
    .sort((a, b) => {
      if (b.today_visitors !== a.today_visitors) {
        return b.today_visitors - a.today_visitors;
      }
      return b.total_visitors - a.total_visitors;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    event_name: event.name,
    rankings: ranked,
  };
}
