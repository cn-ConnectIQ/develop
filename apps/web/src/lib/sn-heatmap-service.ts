import { prisma } from "@connectiq/database";

export async function getSnHeatmapData(eventId: string) {
  const sessions = await prisma.snSession.findMany({
    where: { eventId },
    include: {
      pairs: {
        include: {
          participantA: { select: { id: true, name: true, company: true } },
          participantB: { select: { id: true, name: true, company: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rounds: Array<{
    round: number;
    pair_count: number;
    connection_count: number;
    connection_rate: number;
  }> = [];

  const nodeMap = new Map<
    string,
    { id: string; name: string; company: string | null; connections: number }
  >();

  for (const session of sessions) {
    const roundGroups = new Map<number, typeof session.pairs>();
    for (const pair of session.pairs) {
      const list = roundGroups.get(pair.round) ?? [];
      list.push(pair);
      roundGroups.set(pair.round, list);

      for (const p of [pair.participantA, pair.participantB]) {
        const existing = nodeMap.get(p.id) ?? {
          id: p.id,
          name: p.name,
          company: p.company,
          connections: 0,
        };
        if (pair.connectionEstablished) existing.connections += 1;
        nodeMap.set(p.id, existing);
      }
    }

    for (const [round, pairs] of roundGroups) {
      const conn = pairs.filter((p) => p.connectionEstablished).length;
      rounds.push({
        round,
        pair_count: pairs.length,
        connection_count: conn,
        connection_rate: pairs.length > 0 ? Math.round((conn / pairs.length) * 100) : 0,
      });
    }
  }

  const nodes = [...nodeMap.values()]
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 30);

  const totalPairs = sessions.reduce((n, s) => n + s.pairs.length, 0);
  const totalConnections = sessions.reduce(
    (n, s) => n + s.pairs.filter((p) => p.connectionEstablished).length,
    0,
  );

  return {
    event_id: eventId,
    session_count: sessions.length,
    total_pairs: totalPairs,
    total_connections: totalConnections,
    connection_rate:
      totalPairs > 0 ? Math.round((totalConnections / totalPairs) * 100) : 0,
    rounds,
    top_participants: nodes,
  };
}
